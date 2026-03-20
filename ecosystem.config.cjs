module.exports = {
  apps: [
    {
      name: "api-verifier-web",
      cwd: __dirname,
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
        HOST: "0.0.0.0",
        PORT: "6722",
      },
    },
  ],
};
