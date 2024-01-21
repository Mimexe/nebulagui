module.exports = {
  packagerConfig: {
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
        executableName: "nebulagui",
        description: "Nebula GUI",
        categories: ["Utility"],
      },
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {
        executableName: "nebulagui",
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
