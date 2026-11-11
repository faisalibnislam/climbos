/** Isolated real-business workspace: separate database, no demo seeding, no paid credentials. */
process.argv.push("--real");
await import("./local-demo.mjs");
