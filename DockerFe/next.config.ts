import type { NextConfig } from "next";

// Where the Spring Boot API lives, as seen FROM THE NEXT.JS SERVER (not the browser).
//   - On your laptop (npm run dev):   http://localhost:8080
//   - Inside Docker Compose:          http://backend:8080
//     "backend" is the compose SERVICE NAME. Docker runs a small DNS server on the
//     network, so containers can reach each other by service name.
// NOTE: rewrites are calculated during `next build`, so BACKEND_URL must be set
// when the image is BUILT (see the ARG in DockerFe/Dockerfile), not only at runtime.
const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8080";

const nextConfig: NextConfig = {
  // "standalone" makes `next build` produce .next/standalone: a tiny server.js plus
  // ONLY the node_modules files it actually needs. The Docker image copies just that,
  // instead of the full node_modules folder → a much smaller image.
  output: "standalone",

  // KEY NETWORKING LESSON:
  // The browser only ever talks to the frontend (localhost:3000). When it requests
  // /api/messages, the Next.js server forwards ("proxies") that request to
  // ${BACKEND_URL}/api/messages and passes the answer back.
  //
  // Why not let the browser call the backend directly? Because the browser runs on
  // YOUR computer, outside Docker. It can't resolve "backend" — that name only exists
  // inside the Docker network. The Next.js server runs inside the network, so it can.
  // Bonus: same origin for the browser → no CORS configuration needed.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
