const { default: axios } = require("axios");
const { app, BrowserWindow, ipcMain } = require("electron");
const { existsSync } = require("fs");
const path = require("path");
let nebulDir;
let gserverWindow;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

async function runCmd(cmd, dir) {
  const { spawn } = require("child_process");
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

const createWindow = () => {
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
    const dialog = require("electron").dialog;
    const { cancel, filePaths } = await dialog.showOpenDialog(mainWindow, {
      message: "Selectionner le dossier Nebula",
      title: "Selectionner le dossier Nebula",
      properties: ["openDirectory"],
    });
    if (!cancel) {
      if (!existsSync(path.join(filePaths[0], ".env"))) {
        mainWindow.webContents.executeJavaScript(
          'alert("Ce dossier ne contient pas de .env qui est necessaire pour Nebula")'
        );
        return null;
      }
      return filePaths[0];
    }
  });

  ipcMain.handle("generateDistro", async () => {
    if (!nebulDir) {
      return { error: "Veuillez selectionner le dossier Nebula" };
    }
    await runCmd("npm start -- g distro", nebulDir);
    return null;
  });

  ipcMain.handle("get-forge-popup", async (e) => {
    const dialog = require("electron").dialog;
    if (!gserverWindow) return console.log("gserverWindow is null");
    const { response } = await dialog.showMessageBox(gserverWindow, {
      message: "Selectionner une version de Forge",
      title: "Selectionner une version de Forge",
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
      return { error: "Veuillez selectionner le dossier Nebula" };
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

  ipcMain.handle("confirmServer", async (e, info) => {
    const { serverId, mcVer, forgeVer, fabricVer } = info;
    if (!serverId) {
      return { error: "Veuillez mettre un nom a votre serveur" };
    }
    if (!mcVer) {
      return { error: "Veuillez mettre une version de Minecraft" };
    }
    if (!forgeVer && !fabricVer) {
      return { error: "Veuillez mettre une version de Forge ou Fabric" };
    }
    if (forgeVer && fabricVer) {
      return { error: "Veuillez mettre une seule version de Forge ou Fabric" };
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
      return { error: "Veuillez selectionner le dossier Nebula" };
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
app.on("ready", createWindow);

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
