# Learning Docker with a Real (Tiny) App

This project is a small "messages" app split into three parts:

| Part | Folder | Tech | Port |
|------|--------|------|------|
| Database | (official image) | MySQL 8.4 | 3306 |
| Backend API | `DockerBackend/` | Spring Boot 3, Java 21 | 8080 |
| Frontend | `DockerFe/` | Next.js, TypeScript | 3000 |

The app is deliberately simple. **The point is Docker, not the code.**

```
 Browser ──► frontend:3000 ──(/api/* rewrite)──► backend:8080 ──► db:3306
 (your PC)   └──────────────── Docker network "app-network" ────────────────┘
```

### Where the Docker files are

```
.
├── docker-compose.yml        ← runs db + backend + frontend together (Lesson 3)
├── .env.example              ← passwords/DB name for compose (copy to .env)
├── DockerBackend/
│   ├── Dockerfile            ← 2-stage build: Maven → slim JRE
│   ├── .dockerignore         ← what NOT to send to the build
│   ├── pom.xml
│   └── src/                  ← Spring Boot code (4 small Java files)
└── DockerFe/
    ├── Dockerfile            ← 3-stage build: deps → build → runner
    ├── .dockerignore
    ├── next.config.ts        ← /api proxy to the backend (read the comments)
    ├── package.json
    └── app/                  ← Next.js page
```

Every Docker file has comments explaining each line. Read them in this order:
`DockerBackend/Dockerfile` → `DockerFe/Dockerfile` → `docker-compose.yml`.

---

## 0. What is Docker?

An **image** is a read-only package that contains everything an app needs to run: a
minimal operating system, the runtime (Java, Node…), libraries, and your code. You
build it once from a recipe called a **Dockerfile**, and it runs the same way on every
machine. "Works on my machine" stops being a problem.

A **container** is a running instance of an image, like an object created from a
class. You can start many containers from one image. Each has its own isolated
filesystem, processes and network address. When you delete a container, anything it
wrote inside itself is gone, unless that data was stored in a **volume**.

**Before you start:** install Docker Desktop and check that it works:

```bash
docker --version
docker compose version
```

---

## Lesson 1: Run the backend alone (`docker build` / `docker run`)

The backend needs a database, so first we start MySQL ourselves.

### 1.1 Create a network

Containers on the same **user-defined network** can find each other **by name**.

```bash
docker network create lesson-net
```

### 1.2 Start MySQL

```bash
docker run -d \
  --name db \
  --network lesson-net \
  -e MYSQL_ROOT_PASSWORD=root_password \
  -e MYSQL_DATABASE=messages_db \
  -e MYSQL_USER=app \
  -e MYSQL_PASSWORD=app_password \
  mysql:8.4
```

- `-d` runs it in the background ("detached").
- `--name db` lets other containers on `lesson-net` reach it at the hostname `db`.
- `-e` sets environment variables. The MySQL image uses these to create the database and user.

MySQL needs about 10 to 30 seconds to start the first time. Watch it with `docker logs -f db`
and press Ctrl+C when you see `ready for connections`.

### 1.3 Build the backend image

```bash
docker build -t docker-backend ./DockerBackend
```

- `-t docker-backend` names (tags) the image.
- `./DockerBackend` is the **build context**: the folder Docker sends to the builder, where it finds the `Dockerfile`.

### 1.4 Run the backend container

```bash
docker run -d \
  --name backend \
  --network lesson-net \
  -p 8080:8080 \
  -e DB_HOST=db \
  docker-backend
```

- `-p 8080:8080` means **HOST:CONTAINER**. It makes the container's port 8080 reachable at `localhost:8080` on your computer.
- `DB_HOST=db` points the backend at the MySQL container *by its name*. The other DB settings use the defaults in `application.yml`, which match what we gave MySQL.

Test it:

```bash
curl http://localhost:8080/api/health
curl -X POST http://localhost:8080/api/messages -H "Content-Type: application/json" -d '{"text":"Hello Docker"}'
curl http://localhost:8080/api/messages
curl http://localhost:8080/actuator/health
```

---

## Lesson 2: Run the frontend alone

```bash
docker build -t docker-frontend ./DockerFe

docker run -d \
  --name frontend \
  --network lesson-net \
  -p 3000:3000 \
  docker-frontend
```

Open http://localhost:3000. You should see **Backend status: UP**. Add a few messages.

How does the frontend find the backend? The image was built with
`BACKEND_URL=http://backend:8080` (the default `ARG` in `DockerFe/Dockerfile`). The
container we started in Lesson 1 is named `backend` and is on the same network, so the
name resolves. Your **browser** never talks to `backend`. It only talks to
`localhost:3000`, and the Next.js server forwards `/api/*` for it. See the comments in
`DockerFe/next.config.ts`.

### Clean up

```bash
docker rm -f frontend backend db
docker network rm lesson-net
```

---

## Lesson 3: Docker Compose

### Why the manual way is painful

Look at what we just did: created a network by hand, typed three long `docker run`
commands with many flags, had to start them **in the right order**, and had to wait for
MySQL before starting the backend. To clean up, we had to remember every name. Now
picture doing that every morning, or explaining it to a new teammate.

**Docker Compose** puts all of that in one file, `docker-compose.yml`, and gives you
one command to run it.

### Run everything

```bash
cp .env.example .env          # passwords & DB name (Compose reads .env automatically)
docker compose up --build     # build images, create network + volume, start in order
```

Open http://localhost:3000. Compose starts `db`, waits until it is **healthy**, then
starts `backend`, waits until it is healthy, and then starts `frontend`.

### Redeploy only what you changed

```bash
./deploy.sh              # auto: rebuilds backend, frontend, or both — whatever changed
./deploy.sh backend      # force backend only
./deploy.sh frontend     # force frontend only
./deploy.sh all          # force both
```

### CI/CD (GitHub Actions)

`.github/workflows/ci-cd.yml` does the same thing as `deploy.sh`, but on GitHub on every push:

| Event | What runs |
|---|---|
| Pull request to `main` | Build only the changed image(s), to check the Dockerfiles still work |
| Push to `main` | Build + push changed image(s) to `ghcr.io/<owner>/<repo>/backend` / `frontend`, then deploy |
| Actions tab → "Run workflow" | Rebuild and deploy everything |

The **deploy** step is skipped until you configure a server. In GitHub → Settings →
Secrets and variables → Actions, add:

- **Variables:** `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH` (for example `/opt/noob-dev`)
- **Secrets:** `DEPLOY_SSH_KEY` (private SSH key), `GHCR_TOKEN` (a GitHub token with `read:packages`)

The server needs Docker installed. The deploy job copies `docker-compose.yml` and
`docker-compose.prod.yml` there, then pulls the new images instead of building them,
and restarts **only** the services that changed.

### Everyday commands

| Command | What it does |
|---------|--------------|
| `docker compose up --build` | Build images (if changed) and start all services. Add `-d` to run in the background. |
| `docker compose ps` | List the services, their status and health, and their ports. |
| `docker compose logs -f` | Follow the logs of all services (Ctrl+C to stop following). |
| `docker compose logs -f backend` | Follow the logs of one service. |
| `docker compose exec backend sh` | Open a shell **inside** the running backend container. Type `exit` to leave. |
| `docker compose exec db mysql -u app -papp_password messages_db` | Open a MySQL prompt inside the db container. Try `SELECT * FROM messages;` |
| `docker compose down` | Stop and remove the containers and the network. **The data volume is kept.** |
| `docker compose down -v` | Same, **plus delete volumes**, which gives you an empty database next time. |

Try this: add some messages, run `docker compose down`, then `docker compose up`. The
messages are still there because they live in the `db-data` volume. Now try `down -v`.

---

## 4. Multi-stage builds and layer caching

### Multi-stage builds

Both Dockerfiles have several `FROM` lines. Each one starts a new **stage**:

- **Backend:** stage 1 (`maven:3.9-eclipse-temurin-21`) has Maven and a full JDK and
  compiles the `.jar`. Stage 2 (`eclipse-temurin:21-jre`) only has a Java runtime and
  copies in **just the jar**.
- **Frontend:** `deps` installs `node_modules`, `builder` runs `next build`, and
  `runner` copies only the small `standalone` server and the static files.

Only the **last stage** becomes the final image. Build tools, source code and caches
are left behind, which makes the image much smaller and safer. Compare the sizes:

```bash
docker images
```

### Layer caching

Every instruction in a Dockerfile creates a **layer**. Docker caches layers and reuses
them when nothing they depend on has changed. Once one layer changes, **every layer
after it is rebuilt**.

That's why the backend Dockerfile does this:

```dockerfile
COPY pom.xml .
RUN mvn -B dependency:go-offline   # slow: downloads all dependencies
COPY src ./src                     # your code
RUN mvn -B package -DskipTests
```

**What happens when you change only a `.java` file?**
`COPY pom.xml` → cached. `dependency:go-offline` → **cached, no downloads.**
`COPY src` → changed, so it and the steps after it rerun. The rebuild takes seconds instead of minutes.

If we had written `COPY . .` first, any code change would invalidate the cache and
re-download every dependency. The frontend uses the same trick with
`package.json` / `package-lock.json` before `npm ci`.

Try it: build once, edit `ApiController.java`, then build again and look for `CACHED` in the output.

---

## 5. Common mistakes and troubleshooting

### "Connection refused" because of `localhost` inside a container
Inside a container, `localhost` means **that container itself**. It does not mean your
computer, and it does not mean another container. Use the **service name**: `db`,
`backend`. That's why compose sets `DB_HOST: db` and `BACKEND_URL: http://backend:8080`.

### "Port is already allocated"
Something else on your computer is already using that port, for example a local MySQL
or another `npm run dev`. Stop that program, or change the **left** side of the port
mapping:
```yaml
ports:
  - "8081:8080"   # your computer's 8081 → container's 8080
```

### My code change doesn't show up (stale image)
`docker compose up` reuses existing images. After changing code, rebuild:
```bash
docker compose up --build
# still weird? force a clean build:
docker compose build --no-cache
```

### I changed the DB password in `.env` but it doesn't work
The MySQL image only creates the user and database when it starts **with an empty
volume**. The old data, including the old password, is still in the `db-data` volume.
Reset it with:
```bash
docker compose down -v
docker compose up --build
```
The same goes for "my old test data is still there": volumes persist on purpose.

### Backend keeps restarting / frontend never starts
Check health and logs:
```bash
docker compose ps
docker compose logs backend
```
The frontend only starts once the backend is **healthy**, and the backend only once the db is.

### Running the code without Docker
- Backend: start a MySQL on `localhost:3306`, then `cd DockerBackend && ./mvnw spring-boot:run`.
- Frontend: `cd DockerFe && npm install && npm run dev` (it proxies to `http://localhost:8080` by default).

---

## 6. Exercises

1. **Change a port.** Make the frontend available at http://localhost:4000 *without*
   changing any Dockerfile. (Hint: only one side of `ports` changes.)
2. **Add an environment variable.** Add `APP_GREETING` to the backend service in
   `docker-compose.yml`, read it in Spring with `@Value("${APP_GREETING:Hello}")`, and
   return it from a new `GET /api/greeting` endpoint. Check it with
   `docker compose exec backend env`.
3. **Add a 4th service.** Add a database admin UI, such as
   [phpMyAdmin](https://hub.docker.com/_/phpmyadmin) (`image: phpmyadmin`) or Adminer
   (`image: adminer`), on the same network, published on port 8081. Log in using the
   host name `db`. Why does `db` work as the host but `localhost` does not?
4. **Persistence experiment.** Add messages, then run `down` → `up`, then `down -v` → `up`.
   Explain the difference.
5. **Cache experiment.** Time `docker compose build backend` after changing (a) a
   `.java` file and (b) `pom.xml`. Explain why one is much slower.
6. **Inspect the network.** Run `docker network ls` and `docker network inspect`
   on the compose network. Find the IP address of each container.
