import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const filePath = process.argv[2];

if (!filePath || !filePath.endsWith(".ts")) {
  process.exit(0);
}

const source = readFileSync(filePath, "utf8");

const updated = source.replace(
  /export function (instanceOf\w+)\(value: object\): value is ([^{]+) \{\n([\s\S]*?)\n\}/g,
  (match, functionName, typeName, body) => {
    if (!body.includes("value['") && !body.includes('value["')) {
      return match;
    }

    const updatedBody = body.replace(/value(\[['"][^'"]+['"]\])/g, "record$1");

    return `export function ${functionName}(value: object): value is ${typeName} {\n    const record = value as Record<string, unknown>;\n${updatedBody}\n}`;
  },
);

if (updated !== source) {
  writeFileSync(filePath, updated);
}
