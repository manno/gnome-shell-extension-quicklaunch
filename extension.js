const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const St = imports.gi.St;
const Main = imports.ui.main;
const Shell = imports.gi.Shell;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const FileUtils = imports.misc.fileUtils;

const AppsPath = GLib.get_home_dir() + '/.local/user/apps';

function PopupGiconMenuItem() {
    this._init.apply(this, arguments);
}

PopupGiconMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function (text, gIcon, params) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this, params);

        this.label = new St.Label({ text: text });
        this.addActor(this.label);
        this._icon = new St.Icon({ 
            gicon: gIcon,
            style_class: 'popup-menu-icon' });
        this.addActor(this._icon, { align: St.Align.END });
    },
};

function AppsMenu() {
  this._init.apply(this, arguments);
}

AppsMenu.prototype = {
  __proto__: PanelMenu.SystemStatusButton.prototype,

  _init: function() {
    PanelMenu.SystemStatusButton.prototype._init.call(this, 'start-here');

    this.defaultItems = [];
    this._createDefaultApps();
  },

  _createDefaultApps: function() {
    let _appsDir = Gio.file_new_for_path(AppsPath);

    /* TODO try to list dir async
    FileUtils.listDirAsync(_appsDir, Lang.bind(this, function(files) {
      for (let i = 0; i< files.length; i++) {
        this.defaultItems[i] = new PopupMenu.PopupMenuItem(files[i]);
        this.menu.addMenuItem(this.defaultItems[i]);
      }
    }));
    */

    let fileEnum;
    let file, info;
    let i = 0;
    try {
      fileEnum = _appsDir.enumerate_children('standard::*', Gio.FileQueryInfoFlags.NONE, null);
    } catch (e) {
      global.logError('' + e);
      return;
    }

    // add menu entry for each file
    while ((info = fileEnum.next_file(null)) != null) {
      let fileType = info.get_file_type();
      if (fileType == Gio.FileType.DIRECTORY)
        continue;
      let name = info.get_name();
      if( name.indexOf('.desktop') > -1) {
        let desktopPath =  AppsPath + '/' + name;
        this.defaultItems[i] = this.addAppItem(desktopPath);
        i++;
      }
    }
    fileEnum.close(null);
    
  },

  addAppItem: function(desktopPath) {
    // from http://www.roojs.com/seed/gir-1.2-gtk-3.0/gjs/
    let appInfo = new Gio.DesktopAppInfo.new_from_filename(desktopPath);
    if (!appInfo) {
      global.log('App for desktop file ' + desktopPath + ' could not be loaded!');
      return null;
    }

    let menuItem = this._createAppItem(appInfo, function(w, ev) {
      if(!appInfo.launch([], null)) {
        global.log('Failed to launch ' + appInfo.get_commandline);
      }
    });
    this.menu.addMenuItem(menuItem);

    return menuItem;
  },
        
  _createAppItem: function(appInfo, callback) {
    let menuItem = new PopupGiconMenuItem(appInfo.get_name(), appInfo.get_icon(), {});
    menuItem.connect('activate', Lang.bind(this, function (menuItem, event) {
      callback(menuItem, event);      
    }));

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
