const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const KeyFile = imports.gi.GLib.KeyFile;

const St = imports.gi.St;
const Main = imports.ui.main;
const Shell = imports.gi.Shell;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const FileUtils = imports.misc.fileUtils;

function AppsMenu() {
  this._init.apply(this, arguments);
}

AppsMenu.prototype = {
  __proto__: PanelMenu.SystemStatusButton.prototype,

  _init: function() {
    PanelMenu.SystemStatusButton.prototype._init.call(this, 'folder');

    this.defaultItems = [];
    this._createDefaultApps();
  },

  _createDefaultApps: function() {
    let _appsPath = GLib.get_home_dir() + '/Desktop/Apps';
    let _appsDir = Gio.file_new_for_path(_appsPath);

    /* try to list dir async
    FileUtils.listDirAsync(_appsDir, Lang.bind(this, function(files) {
      for (let i = 0; i< files.length; i++) {
        this.defaultItems[i] = new PopupMenu.PopupMenuItem(files[i]);
        this.menu.addMenuItem(this.defaultItems[i]);
      }
    }));
    */

    /* from fileUtils.js, * extensionSystem.js */
    let fileEnum;
    let file, info;
    let i = 0;
    try {
      fileEnum = _appsDir.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);
    } catch (e) {
      global.logError('' + e);
      return;
    }

    while ((info = fileEnum.next_file(null)) != null) {
      let fileType = info.get_file_type();
      if (fileType == Gio.FileType.DIRECTORY)
        continue;
      let name = info.get_name();
      if( name.indexOf('.desktop') > -1) {
        // add menu entry
        let desktopPath =  _appsPath + '/' + name;
        this.defaultItems[i] = this.addAppItem(desktopPath);
        i++;
      }
    }
    fileEnum.close(null);
    //let app = Shell.AppSystem.get_default().lookup_setting(_appsPath + 'term.desktop');
    //app.activate();

  /*
   * create menu entry

  let placeid = 0;
  this.defaultItems[placeid] = new PopupMenu.PopupMenuItem("teST");
  let icon = this.defaultPlaces[placeid].iconFactory(PLACE_ICON_SIZE);
  this.defaultItems[placeid].addActor(icon, { align: St.Align.END});
  this.defaultItems[placeid].place = this.defaultPlaces[placeid];
  this.menu.addMenuItem(this.defaultItems[placeid]);
  */
    
  },

  addAppItem: function(desktopPath) {
    // load desktop file
    let appInfo = new Gio.DesktopAppInfo.new_from_filename(desktopPath);
    if (!appInfo) {
      global.log('App for desktop file ' + desktopPath + ' could not be loaded!');
      return;
    }

    // click handler -- no more syntax errors in here?
    let menuItem = this._createAppItem(appInfo, function(w, ev) {
        if(! appInfo.launch([], NULL)) {
          global.log('Failed to launch ' + appInfo.get_commandline);
        }
    });
    this.menu.addMenuItem(menuItem);

    return menuItem;
  },
        
  _createAppItem: function(appInfo, callback) {
    let menuItem = new PopupMenu.PopupMenuItem(appInfo.get_name());
    menuItem.connect('activate', Lang.bind(this, function (menuItem, event) {
      callback(menuItem, event);      
    }));
    menuItem.icon = appInfo.get_icon();
    return menuItem;
  },  
};

function init() {
}

let _indicator;

function enable() {
  _indicator = new AppsMenu;
  Main.panel.addToStatusArea('apps-menu', _indicator);
}

function disable() {
  _indicator.destroy();
}
