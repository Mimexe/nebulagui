const { default: axios } = require("axios");
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { existsSync, readFileSync, createWriteStream } = require("fs");
const path = require("path");
const archiver = require("archiver");
const { dialog } = require("electron");
let nebulDir;
let gserverWindow;
let lang;
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

async function runCmd(cmd, dir) {
  const { spawn, execSync } = require("child_process");
  return new Promise((resolve, reject) => {
    const child = spawn("start", ["/wait", "cmd", '/c "', cmd, ' & pause"'], {
      shell: true,
      cwd: dir,
    });
    child.stdout.on("data", (data) => {
      console.log(data.toString().trim());
    });
    child.stderr.on("data", (data) => {
      console.log("[stderr] " + data.toString().trim());
    });
    child.on("close", async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      resolve();
    });
  });
}

const createWindow = async () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true,
  });
  mainWindow.on("closed", () => {
    app.quit();
  });

  ipcMain.handle("getNebulaDir", async () => {
    const { cancel, filePaths } = await dialog.showOpenDialog(mainWindow, {
      message:
        lang == "en"
          ? "Select your Nebula folder"
          : "Selectionner votre dossier Nebula",
      title:
        lang == "en"
          ? "Select your Nebula folder"
          : "Selectionner votre dossier Nebula",
      properties: ["openDirectory"],
    });
    if (!cancel && filePaths.length > 0) {
      if (!existsSync(path.join(filePaths[0], ".env"))) {
        mainWindow.webContents.executeJavaScript(
          'alert("' +
            (lang == "en"
              ? "This folder doesn't contain a .env which is required for Nebula"
              : "Ce dossier ne contient pas de .env qui est necessaire pour Nebula") +
            '")'
        );
        return null;
      }
      return filePaths[0];
    }
  });

  ipcMain.handle("generateDistro", async () => {
    if (!nebulDir) {
      return {
        error:
          lang == "en"
            ? "Please select your Nebula folder"
            : "Veuillez selectionner le dossier Nebula",
      };
    }
    await runCmd("npm start -- g distro", nebulDir);
    return null;
  });

  ipcMain.handle("get-forge-popup", async (e) => {
    if (!gserverWindow) return console.log("gserverWindow is null");
    const { response } = await dialog.showMessageBox(gserverWindow, {
      message:
        lang == "en"
          ? "Select Forge version"
          : "Selectionner la version de Forge",
      title:
        lang == "en"
          ? "Select Forge version"
          : "Selectionner la version de Forge",
      buttons: ["latest", "recommended"],
    });
    return response === 0 ? "latest" : "recommended";
  });

  ipcMain.handle("get-forge", async (e, type, version) => {
    const res = await axios.get(
      "https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json",
      { headers: { "User-Agent": "NebulaGUI/1.0.0 (MIME)" } }
    );
    const { promos } = res.data;
    if (!type) {
      throw new Error("Type is required");
    }
    if (type !== "recommended" && type !== "latest") {
      throw new Error("Type must be recommended or latest");
    }
    if (!version) {
      return { error: "Version is required" };
    }
    if (!promos[`${version}-${type}`]) {
      return { error: "Version not found" };
    }
    const ver = promos[`${version}-${type}`];
    return { version: ver };
  });

  ipcMain.handle("initRoot", async () => {
    if (!nebulDir) {
      return {
        error:
          lang == "en"
            ? "Please select your Nebula folder"
            : "Veuillez selectionner le dossier Nebula",
      };
    }
    await runCmd("npm start -- init root", nebulDir);
    return null;
  });

  ipcMain.on("nebulaDir", (e, dir) => {
    nebulDir = dir;
  });

  ipcMain.handle("generateServer", async () => {
    const rres = await new Promise((resolve) => {
      gserverWindow = new BrowserWindow({
        width: 600,
        height: 300,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
        },
        autoHideMenuBar: true,
      });
      gserverWindow.on("closed", () => {
        resolve();
      });
      gserverWindow.loadFile(path.join(__dirname, "gserver.html"));
    });
    return rres;
  });

  ipcMain.handle("zipRootFolder", async () => {
    if (!nebulDir) {
      return {
        error:
          lang == "en"
            ? "Please select your Nebula folder"
            : "Veuillez selectionner le dossier Nebula",
      };
    }
    // get the root folder
    const envfile = path.join(nebulDir, ".env");
    if (!existsSync(envfile)) {
      return {
        error:
          lang == "en"
            ? "This folder doesn't contain a .env which is required for Nebula"
            : "Ce dossier ne contient pas de .env qui est necessaire pour Nebula",
      };
    }
    const envlines = readFileSync(envfile, "utf-8").split("\n");
    let rootFolder;
    for (const line of envlines) {
      if (line.startsWith("ROOT=")) {
        rootFolder = line.split("=")[1].trim();
        break;
      }
    }
    if (!rootFolder) {
      return {
        error:
          lang == "en"
            ? "This folder doesn't contain a .env which is required for Nebula"
            : "Ce dossier ne contient pas de .env qui est necessaire pour Nebula",
      };
    }
    const zipPath = path.join(rootFolder, "root.zip");
    if (existsSync(zipPath)) {
      return {
        error:
          lang == "en"
            ? "This folder already contains a root.zip"
            : "Ce dossier contient deja un root.zip",
      };
    }
    const dirs = [`${rootFolder}\\servers`, `${rootFolder}\\repo`];
    const files = [`${rootFolder}\\distribution.json`];
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", {
      zlib: { level: 9 },
    });
    archive.pipe(output);
    for (const dir of dirs) {
      archive.directory(dir, path.basename(dir));
    }
    for (const file of files) {
      archive.file(file, { name: path.basename(file) });
    }
    output.on("close", () => {
      console.log(archive.pointer() + " total bytes");
    });
    await archive.finalize();
    shell.showItemInFolder(zipPath);
    return null;
  });

  ipcMain.on("restartApp", () => {
    app.relaunch();
    app.exit();
  });

  ipcMain.handle("lang", () => lang);

  ipcMain.on("createNebula", () => {
    mainWindow.hide();
    const nebulawindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
      autoHideMenuBar: true,
    });
    nebulawindow.on("closed", () => {
      mainWindow.show();
    });
    nebulawindow.loadFile(path.join(__dirname, "create.html"));
  });

  ipcMain.handle("confirmServer", async (e, info) => {
    const { serverId, mcVer, forgeVer, fabricVer } = info;
    if (!serverId) {
      return {
        error:
          lang == "en"
            ? "Please enter a name for your server"
            : "Veuillez mettre un nom a votre serveur",
      };
    }
    if (!mcVer) {
      return {
        error:
          lang == "en"
            ? "Please enter a Minecraft version"
            : "Veuillez mettre une version de Minecraft",
      };
    }
    if (!forgeVer && !fabricVer) {
      return {
        error:
          lang == "en"
            ? "Please enter a Forge or Fabric version"
            : "Veuillez mettre une version de Forge ou Fabric",
      };
    }
    if (forgeVer && fabricVer) {
      return {
        error:
          lang == "en"
            ? "Please enter only one version of Forge or Fabric"
            : "Veuillez mettre une seule version de Forge ou Fabric",
      };
    }
    let f = "";
    if (forgeVer) {
      f = `--forge ${forgeVer}`;
    } else if (fabricVer) {
      f = `--fabric ${fabricVer}`;
    }
    const cmd = `npm start -- g server ${serverId} ${mcVer} ${f}`;
    console.log(cmd);
    console.log(nebulDir);
    if (!nebulDir) {
      return {
        error:
          lang == "en"
            ? "Please select your Nebula folder"
            : "Veuillez selectionner le dossier Nebula",
      };
    }
    await runCmd(cmd, nebulDir);
    return { success: true };
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "index.html"));
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", async () => {
  lang = await new Promise(async (resolve) => {
    const r = await dialog.showMessageBox({
      message: "Select your language/Selectionner votre langue",
      title: "NebulaGUI",
      buttons: ["Français", "English"],
    });
    resolve(r.response === 0 ? "fr" : "en");
  });
  console.log(lang);
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
