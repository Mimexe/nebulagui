module.exports = {
  packagerConfig: {
    executableName: "nebulagui",
    asar: true,
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {},
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-deb",
      config: {
        description: "Nebula GUI",
        categories: ["Utility"],
      },
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {
        description: "Nebula GUI",
        categories: ["Utility"],
      },
    },
  ],
  plugins: [
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
  ],
};
