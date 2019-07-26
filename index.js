const {app, BrowserWindow, ipcMain} = require('electron')
const path = require('path')
const url = require('url')
const fs = require('fs')
const ejse = require('ejs-electron')
var sqlite3 = require('sqlite3').verbose();
var databaseFile = 'BSafes.db';
var db = null;
var loginUserId;
var arrDownloadQueue = [];
//var threads = require('./thread.js');
var download_folder_path = 'bsafes_downloads/';

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win;
let thread_win;

global.sqliteDB = db;
global.loginUserId = loginUserId;
global.logMesage = [];
global.isDev = true;

function createWindow () {
  // Create the browser window.
  win = new BrowserWindow({
    width: 900, 
    height: 700,
    webPreferences: {
        //nodeIntegration: false,
        preload: path.join(__dirname, 'preload.js')
    }
  })

  //ejse.data('masterId', 'F_hRPgswTh1se8DuWy6762ojHUWOvn6dch4KIvaIo4flg=')
  //ejse.data('displayMasterId', '2339894959580958')

  // and load the index.html of the app.
  win.loadURL(url.format({
    pathname: path.join(__dirname, 'Bsafes/views/managedMemberSignIn.ejs'),
    //pathname: path.join(__dirname, 'Bsafes/views/index.ejs'),
    protocol: 'file:',
    slashes: true
  }))

  

  // clear cache.
  let session = win.webContents.session;
  // session.cookies.get({ url : 'https://www.openbsafes.com' }, function(error, cookies) {
  //     console.log(cookies);
  // });
  session.cookies.remove('https://www.openbsafes.com', 'connect.sid', function(data) {});
  
  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
  })

  var thread_win = new BrowserWindow({ parent: win })
  thread_win.loadURL(url.format({
    pathname: path.join(__dirname, 'thread.ejs'),
    protocol: 'file:',
    slashes: true
  }))
  thread_win.webContents.openDevTools();
  
  if (global.isDev) {    
    // Open the DevTools.
    win.webContents.openDevTools();
  } else {
    win.setMenu(null);
    thread_win.hide();
  }

}

function initSQLiteDB()
{
  // check whether database file exists...
  fs.access(databaseFile, fs.F_OK, (err) => {
    if (err) {
      //console.error(err)
      fs.closeSync(fs.openSync(databaseFile, 'w'));
      //return;
    }
    //file exists
    db = new sqlite3.Database(databaseFile, (err) => {
      if (err) {
        return console.error(err.message);
      }
      console.log('Connected to the BSafes SQlite database.');
    });

    global.sqliteDB = db;

    db.serialize(function() {
      sql = "CREATE TABLE IF NOT EXISTS 'teamList' (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, jsonData BLOB, total TEXT, downloaded TEXT); ";
      db.run(sql);

      sql = "CREATE TABLE IF NOT EXISTS 'downloadList' (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, itemId TEXT); ";
      db.run(sql);

      sql = "CREATE TABLE IF NOT EXISTS 'teams' (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, teamId TEXT, isDownload INTEGER, jsonData BLOB); ";
      db.run(sql);

      sql = "CREATE TABLE IF NOT EXISTS 'containers' (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, containerId TEXT, isDownload INTEGER, jsonData BLOB); ";
      db.run(sql);

      sql = "CREATE TABLE IF NOT EXISTS 'pages' (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, pageId TEXT, containerId TEXT, teamId TEXT, " + 
                " counterContentsImages INTEGER DEFAULT -1, downloadedContentsImages INTEGER DEFAULT 0, " + 
                " counterVideos INTEGER DEFAULT -1, downloadedVideos INTEGER DEFAULT 0, " +
                " counterImages INTEGER DEFAULT -1, downloadedImages INTEGER DEFAULT 0, " + 
                " counterAttatchments INTEGER DEFAULT -1, downloadedAttatchments INTEGER DEFAULT 0, isDownload INTEGER DEFAULT 0); ";
      db.run(sql);

      sql = "CREATE TABLE IF NOT EXISTS 'pageContents' (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, pageId TEXT, jsonData BLOB); ";
      db.run(sql);

      sql = "CREATE TABLE IF NOT EXISTS 'pageContentsFiles' (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, pageId TEXT, s3Key TEXT, file_name TEXT); ";
      db.run(sql);

      sql = "CREATE TABLE IF NOT EXISTS 'pageVideos' (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, pageId TEXT, s3Key TEXT, file_name TEXT, jsonData BLOB); ";
      db.run(sql);

      sql = "CREATE TABLE IF NOT EXISTS 'pageAttatchments' (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, pageId TEXT, chunkIndex TEXT, s3KeyPrefix TEXT, file_name TEXT, jsonData BLOB); ";
      db.run(sql);

      sql = "CREATE TABLE IF NOT EXISTS 'pageImages' (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, pageId TEXT, s3Key TEXT, file_name TEXT, jsonData BLOB); ";
      db.run(sql);

      sql = "CREATE TABLE IF NOT EXISTS 'itemPath' (" +
              "id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, itemId TEXT, jsonData BLOB); ";
      db.run(sql);

      sql = "CREATE TABLE IF NOT EXISTS 'logs' (" +
              "id INTEGER PRIMARY KEY AUTOINCREMENT, itemName TEXT, itemID TEXT, position TEXT, status TEXT, total TEXT, downloaded TEXT, logTime TEXT); ";
      db.run(sql);

      sql = "CREATE TABLE IF NOT EXISTS 'info' (" +
              "id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT, jsonData BLOB); ";
      db.run(sql);

      sql = "UPDATE pages SET isDownload = -1 WHERE isDownload = 0";
      db.run(sql);      
      
    });

    //threads.downloadPages(db);
    //threads.downloadPages('p:mF_hRPgswTh1se8DuWy6762ojHUWOvn6dch4KIvaIo4flg=-1558941669974:1:1559177877327');

  })  
  
}

function initApp()
{
  

  if (!fs.existsSync(download_folder_path)){
    fs.mkdirSync(download_folder_path);
  }

  initSQLiteDB();
}

initApp();

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
//   if (process.platform !== 'darwin') {
    app.quit()
    //db.close();
//   }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})

ipcMain.on('show-message', (event, msg) => {
    if (win) {
        win.webContents.send('show-message', msg);
    }
})

ipcMain.on( "setMyGlobalVariable", ( event, myGlobalVariableValue ) => {
  global.loginUserId = myGlobalVariableValue;
} );

ipcMain.on( "sendDownloadMessage", ( event, message ) => {
  global.logMesage.push(message);  
} );

ipcMain.on( "clearDownloadLogs", ( event, message ) => {
  //global.logMesage = [];
} );