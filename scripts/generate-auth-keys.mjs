// Generates the RS256 key pair Convex Auth needs and sets it on the current
// Convex deployment without printing the private key.
// Usage: node scripts/generate-auth-keys.mjs [--prod]
import { generateKeyPairSync } from "node:crypto";
import { execFileSync } from "node:child_process";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pkcs8 = privateKey.export({ type: "pkcs8", format: "pem" }).toString().trimEnd().replace(/\n/g, " ");
const jwk = publicKey.export({ format: "jwk" });
const jwks = JSON.stringify({ keys: [{ use: "sig", alg: "RS256", ...jwk }] });
const prod = process.argv.includes("--prod") ? ["--prod"] : [];
execFileSync("npx", ["convex", "env", "set", ...prod, "JWT_PRIVATE_KEY", "--", pkcs8], { stdio: ["ignore", "ignore", "inherit"] });
execFileSync("npx", ["convex", "env", "set", ...prod, "JWKS", jwks], { stdio: ["ignore", "ignore", "inherit"] });
console.log(`JWT_PRIVATE_KEY and JWKS set on the ${prod.length ? "production" : "dev"} deployment.`);
