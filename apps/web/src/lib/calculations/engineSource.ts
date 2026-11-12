/**
 * The calculation engine, run by Pyodide in `sandboxSource.ts`. A port of
 * experiment-manager's `app/services/calculation_service.py` (`dry_run`,
 * `_eval_one`, `_resolve_order`, …) and the helpers it uses from
 * `app/form_schema.py`. Keep it in step with those: templates authored here
 * must behave the same under the MCP tools, which still call the backend.
 *
 * Pyodide 0.27 is CPython 3.12, the backend's version. That matters: a list
 * comprehension in a formula only sees `values`/builtins through PEP 709
 * inlining (3.12+).
 */
export const ENGINE_SOURCE = String.raw`
import ast
import copy
import json
import math
import statistics

CALC_BUILTINS = {
    "round": round,
    "abs": abs,
    "min": min,
    "max": max,
    "sum": sum,
    "len": len,
    "zip": zip,
    "mean": statistics.mean,
    "median": statistics.median,
    "stdev": statistics.stdev,
}

# Formulas can set attributes on what they're given (math.pi = 3, mean.x = 1).
# The backend runs each request in a fresh process; this interpreter is
# reused, so restore them.
_SHARED = (math, statistics.mean, statistics.median, statistics.stdev)
_SHARED_STATE = [dict(vars(obj)) for obj in _SHARED]


def _reset_shared_state():
    for obj, saved in zip(_SHARED, _SHARED_STATE):
        state = vars(obj)
        state.clear()
        state.update(saved)


def iter_questions(form, expand_repeatable_groups=True):
    if not isinstance(form, dict):
        return []
    questions = form.get("questions")
    if not isinstance(questions, list):
        return []
    out = []
    for q in questions:
        if not isinstance(q, dict):
            continue
        out.append(q)
        if expand_repeatable_groups and q.get("type") == "repeatable-group":
            config = q.get("config") or {}
            children = config.get("questions") if isinstance(config, dict) else None
            if isinstance(children, list):
                out.extend(child for child in children if isinstance(child, dict))
    return out


def find_duplicate_question_ids(state):
    seen = {}
    for form_key in ("clientForm", "labForm"):
        for q in iter_questions(state.get(form_key)):
            q_id = q.get("id")
            if isinstance(q_id, str):
                seen[q_id] = seen.get(q_id, 0) + 1
    return sorted(q_id for q_id, count in seen.items() if count > 1)


def _question_default(q):
    config = q.get("config") or {}
    if isinstance(config, dict) and config.get("default") is not None:
        return config["default"]
    return q.get("default")


def _collect_repeatable_group_defaults(group, values):
    config = group.get("config") or {}
    if not isinstance(config, dict):
        return
    count = config.get("count")
    children = config.get("questions")
    if not isinstance(count, int) or not isinstance(children, list):
        return
    for child in children:
        if not isinstance(child, dict):
            continue
        child_id = child.get("id")
        if not isinstance(child_id, str) or child_id in values:
            continue
        default = _question_default(child)
        if default is not None:
            values[child_id] = [default] * count


def collect_values(state):
    values = dict(state.get("values") or {})
    for form_key in ("clientForm", "labForm"):
        for q in iter_questions(state.get(form_key), expand_repeatable_groups=False):
            if q.get("type") == "repeatable-group":
                _collect_repeatable_group_defaults(q, values)
                continue
            q_id = q.get("id")
            if not isinstance(q_id, str) or q_id in values:
                continue
            default = _question_default(q)
            if default is not None:
                values[q_id] = default
    return values


def calculation_formulas(calculations):
    formulas = {}
    for name, entry in (calculations or {}).items():
        if isinstance(entry, dict):
            formula = entry.get("formula")
            if isinstance(formula, str):
                formulas[name] = formula
        elif isinstance(entry, str):
            formulas[name] = entry
    return formulas


def _referenced_names(expr):
    try:
        tree = ast.parse(expr, mode="exec")
    except SyntaxError:
        return set()
    return {node.id for node in ast.walk(tree) if isinstance(node, ast.Name)}


def _referenced_value_keys(expr):
    try:
        tree = ast.parse(expr, mode="exec")
    except SyntaxError:
        return set()
    return {
        node.slice.value
        for node in ast.walk(tree)
        if isinstance(node, ast.Subscript)
        and isinstance(node.value, ast.Name)
        and node.value.id == "values"
        and isinstance(node.slice, ast.Constant)
        and isinstance(node.slice.value, str)
    }


def _resolve_order(formulas):
    names = set(formulas)
    deps = {
        name: _referenced_names(expr) & names - {name}
        for name, expr in formulas.items()
    }
    order = []
    resolved = set()
    remaining = dict(deps)
    while remaining:
        ready = sorted(name for name, unmet in remaining.items() if unmet <= resolved)
        if not ready:
            break
        for name in ready:
            order.append(name)
            resolved.add(name)
            del remaining[name]
    return order, sorted(remaining)


def _coerce_numeric(value):
    if isinstance(value, list):
        return [_coerce_numeric(item) for item in value]
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            try:
                return float(value)
            except ValueError:
                return value
    return value


def _eval_formula(expr, namespace):
    restricted = {"__builtins__": {}}
    tree = ast.parse(expr, mode="exec")
    if tree.body and isinstance(tree.body[-1], ast.Expr):
        final = tree.body.pop()
        if tree.body:
            exec(compile(tree, "<formula>", "exec"), restricted, namespace)
        return eval(
            compile(ast.Expression(final.value), "<formula>", "eval"),
            restricted,
            namespace,
        )
    namespace.pop("result", None)
    exec(compile(tree, "<formula>", "exec"), restricted, namespace)
    return namespace.get("result")


def _finite(value):
    """Non-finite floats as null, as the backend's response serializer writes them."""
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, list):
        return [_finite(item) for item in value]
    return value


def _base_namespace(values):
    return {
        **CALC_BUILTINS,
        "math": math,
        "values": {name: _coerce_numeric(value) for name, value in values.items()},
    }


# Generator/frame attributes reach builtins without "__" (gi_frame.f_back...).
# The backend runs each request in a throwaway process; here an escape would
# run in a staff member's browser and persist in the shared interpreter.
_BLOCKED_ATTRIBUTE_PREFIXES = ("_", "gi_", "cr_", "ag_", "f_", "tb_", "co_")


def _blocked_attribute(expr):
    try:
        tree = ast.parse(expr, mode="exec")
    except SyntaxError:
        return None
    for node in ast.walk(tree):
        # A class pattern (case o(gi_frame=f)) reads attributes too.
        if isinstance(node, ast.Attribute):
            names = [node.attr]
        elif isinstance(node, ast.MatchClass):
            names = node.kwd_attrs
        else:
            continue
        for attr in names:
            if attr.startswith(_BLOCKED_ATTRIBUTE_PREFIXES):
                return attr
    return None


def _error(kind, message, names=None):
    return {"kind": kind, "message": message, "names": names or []}


def _eval_one(name, expr, namespace):
    if "__" in expr:
        return None, _error(
            "dunder", f"Invalid expression in '{name}': dunder access not allowed"
        )
    blocked = _blocked_attribute(expr)
    if blocked is not None:
        return None, _error(
            "forbidden_attribute",
            f"Invalid expression in '{name}': attribute '{blocked}' not allowed",
        )
    try:
        value = _eval_formula(expr, namespace)
    except ZeroDivisionError:
        return None, _error("zero_division", f"Division by zero in '{name}'")
    except NameError as exc:
        return None, _error(
            "undefined_name",
            f"Undefined variable in '{name}': {exc}",
            [exc.name] if exc.name else [],
        )
    except KeyError as exc:
        key = str(exc.args[0]) if exc.args else ""
        return None, _error(
            "missing_value",
            f"Missing value in '{name}': no answer for '{key}'",
            [key] if key else [],
        )
    except SyntaxError as exc:
        return None, _error("syntax", f"Calculation error in '{name}': {exc}")
    except Exception as exc:
        return None, _error("runtime", f"Calculation error in '{name}': {exc}")

    if isinstance(value, float) and not math.isfinite(value):
        return None, _error(
            "non_finite", f"Non-finite result in '{name}' (got {value})"
        )
    return value, None


_ITERABLES = (list, tuple, set, frozenset, type({}.keys()), type({}.values()), type({}.items()))


def _jsonable(value):
    """What the backend's pydantic serializer makes of a result."""
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, dict):
        return {
            ("true" if k else "false") if isinstance(k, bool) else str(k): _jsonable(v)
            for k, v in value.items()
        }
    if isinstance(value, (bytes, bytearray)):
        return value.decode()
    if isinstance(value, complex):
        return str(value).strip("()")
    if isinstance(value, _ITERABLES) or hasattr(type(value), "__next__"):
        return [_jsonable(item) for item in value]
    raise TypeError(type(value).__name__)


def dry_run(body):
    _reset_shared_state()
    draft = {
        "clientForm": body.get("clientForm"),
        "labForm": body.get("labForm"),
        "values": body.get("values") or {},
    }
    values = collect_values(draft)
    formulas = calculation_formulas(body.get("calculations"))

    namespace = _base_namespace(values)
    # Formulas may rebind or mutate "values"; report the answers they were given.
    coerced = copy.deepcopy(namespace["values"])
    order, unresolved = _resolve_order(formulas)
    outcomes = {}
    failed = set()

    for name in order:
        expr = formulas[name]
        blocked = sorted(_referenced_names(expr) & failed)
        if blocked:
            outcomes[name] = {
                "formula": expr,
                "status": "skipped",
                "result": None,
                "error": _error(
                    "dependency_failed",
                    "Not evaluated — depends on "
                    f"{', '.join(blocked)}, which did not produce a result",
                    blocked,
                ),
            }
            failed.add(name)
            continue

        value, error = _eval_one(name, expr, namespace)
        if error is not None:
            outcomes[name] = {
                "formula": expr,
                "status": "error",
                "result": None,
                "error": error,
            }
            failed.add(name)
            continue

        namespace[name] = value
        outcomes[name] = {
            "formula": expr,
            "status": "ok",
            "result": value,
            "error": None,
        }

    cycle = ", ".join(unresolved)
    for name in unresolved:
        outcomes[name] = {
            "formula": formulas[name],
            "status": "error",
            "result": None,
            "error": _error(
                "circular",
                f"Circular dependency among calculations: {cycle}",
                sorted(set(unresolved) - {name}),
            ),
        }

    # Serialized after every formula ran, as the backend does, so a dependent
    # sees the same object (e.g. an unconsumed zip). The backend answers a
    # result it can't serialize with a 500 for the whole run; report it here.
    for name, outcome in outcomes.items():
        if outcome["status"] != "ok":
            continue
        try:
            outcome["result"] = _jsonable(outcome["result"])
            json.dumps(outcome["result"], allow_nan=False)
        except (TypeError, ValueError, RecursionError):
            kind = type(namespace.get(name)).__name__
            outcome.update(
                status="error",
                result=None,
                error=_error(
                    "runtime",
                    f"Calculation error in '{name}': a {kind} result can't be saved",
                ),
            )

    referenced = set()
    for expr in formulas.values():
        referenced |= _referenced_value_keys(expr)

    return {
        "values": {name: _finite(value) for name, value in coerced.items()},
        "order": order,
        "calculations": {name: outcomes[name] for name in formulas if name in outcomes},
        "missing_values": sorted(referenced - set(values)),
        "duplicate_question_ids": find_duplicate_question_ids(draft),
    }


def dry_run_json(body_json):
    body = json.loads(body_json)
    report = dry_run(body)
    # What POST /calculate would store, kept as Python-serialized text:
    # JSON.parse would turn 5.0 into 5, and the PDF renders str(result).
    calculations = {
        name: {"formula": outcome["formula"], "result": outcome["result"]}
        for name, outcome in report["calculations"].items()
        if outcome["status"] == "ok"
    }
    return json.dumps(
        {
            "report": report,
            "values": json.dumps(collect_values(body), allow_nan=False),
            "calculations": json.dumps(calculations, allow_nan=False),
        },
        allow_nan=False,
    )
`;
