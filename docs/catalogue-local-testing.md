# Local catalogue testing in OrbStack

Keep `chemical-mapfox` and `experiment-manager` next to each other. From the
`chemical-mapfox` directory, run:

```sh
docker compose -f docker-compose.catalogue.yml up --build -d
```

Open <http://localhost:55441/internal/experiment/onboarding>. Sign in as
`admin@example.com` with password `password123`. To inspect the signed-in client
catalogue, sign out and use `client@example.com` with the same password.
The API and OpenAPI documentation are at <http://localhost:55440/docs>.

The preview runs the actual Experiment Manager API, PostgreSQL, Redis and
a production ChemFox build. S3 uses the official Moto testing image because the
legacy MinIO images used by the observability stack are unavailable.
Authentication and ticketing use the existing
acceptance-test doubles with local test accounts. Those accounts and tickets
reset when `test-services` restarts; they are for this local preview only.

On its first start, PostgreSQL applies migrations 001–007, the development seed
catalogue, then migration 008. Existing seeded specimens and experiments are
visible, ordered alphabetically. New entries start hidden and append to the end.
Drag handles reorder both catalogues; visibility only changes
the public landing page. Hidden entries retain their positions. An experiment
needs a non-empty PDF report layout before clients can request it, regardless of
public visibility.

Catalogue settings survive container restarts in the named PostgreSQL volume.
Generated report files in the S3 test double reset when object-storage restarts.
Rebuild after source changes with the same command. Stop the preview with:

```sh
docker compose -f docker-compose.catalogue.yml down
```

Add `--volumes` only when you want to discard this preview's database and storage
and recreate the seed catalogue. This stack uses ports 55440 and 55441 so an
existing development server on port 3000 can keep running.
