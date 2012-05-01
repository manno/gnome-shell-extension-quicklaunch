/* vim: ts=4 sw=4
 */
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const St = imports.gi.St;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Shell = imports.gi.Shell;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const FileUtils = imports.misc.fileUtils;
const Util = imports.misc.util;

const AppsPath = GLib.get_home_dir() + '/.local/share/gnome-shell/quicklaunch';
const AppsPaths = [ GLib.get_home_dir() + '/.local/user/apps', AppsPath ];

/*
 * Gicon Menu Item Object
 */
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

/*
 * AppsMenu Object
 */
function AppsMenu() {
    this._init.apply(this, arguments);
}

AppsMenu.prototype = {
    __proto__: PanelMenu.SystemStatusButton.prototype,

    _init: function() {
        PanelMenu.SystemStatusButton.prototype._init.call(this, 'start-here');
        this.connect('destroy', Lang.bind(this, this._onDestroy));
        this._setupDirectory();
        this._setupAppMenuItems();
        this._setupNewDialog();
        this._setupDirectoryMonitor();
    },

    _onDestroy: function() {
        this._monitor.cancel();
        Mainloop.source_remove(this._appDirectoryTimeoutId);
    },

    /*
     * create dir unless exists
     */
    _setupDirectory: function() {
        let dir = Gio.file_new_for_path(AppsPath);
        if (!dir.query_exists(null)) {
            global.log('create dir ' + AppsPath );
            dir.make_directory_with_parents(null);
        }
        this._appDirectory = dir;
    },

    /*
     * reload the menu
     */
    _reloadAppMenu: function() {
        this.menu.removeAll();
        this._setupAppMenuItems();
        this._setupNewDialog();
    },

    /*
     * change directory monitor, see placeDisplay.js
     */
    _setupDirectoryMonitor: function() {
        if (!this._appDirectory.query_exists(null))
            return;
        this._monitor = this._appDirectory.monitor_directory(Gio.FileMonitorFlags.NONE, null);
        this._appDirectoryTimeoutId = 0;
        this._monitor.connect('changed', Lang.bind(this, function () {
            if (this._appDirectoryTimeoutId > 0)
                return;
            /* Defensive event compression */
            this._appDirectoryTimeoutId = Mainloop.timeout_add(100, Lang.bind(this, function () {
                this._appDirectoryTimeoutId = 0;
                this._reloadAppMenu();
                return false;
            }));
        }));
    },

    /*
     * setup menu items for all desktop files
     */
    _setupAppMenuItems: function(path) {
        for (let path in AppsPaths)
            this._createDefaultApps(AppsPaths[path]);
    },

    /*
     * load desktop files from a directory
     */
    _createDefaultApps: function(path) {
        let _appsDir = Gio.file_new_for_path(path);
        if (!_appsDir.query_exists(null)) {
            global.log('App path ' + path + ' could not be opened!');
            return;
        }

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
                let desktopPath =  GLib.build_filenamev([path, name]);
                this._addAppItem(desktopPath);
                i++;
            }
        }
        fileEnum.close(null);
    },

    /*
     * add menu item to popup
     */
    _addAppItem: function(desktopPath) {
        // from http://www.roojs.com/seed/gir-1.2-gtk-3.0/gjs/
        let appInfo = Gio.DesktopAppInfo.new_from_filename(desktopPath);
        if (!appInfo) {
            global.log('App for desktop file ' + desktopPath + ' could not be loaded!');
            return null;
        }

        let menuItem = this._createAppItem(appInfo, function(w, ev) {
            if(!appInfo.launch([], null)) {
                global.log('Failed to launch ' + appInfo.get_commandline);
            }
        });

        // alphabetically sort list by app name
        let sortKey = appInfo.get_name() || desktopPath;
        let pos = Util.lowerBound(this.menu._getMenuItems(), sortKey, function (a,b) {
            if (String(a.label.text).toUpperCase() > String(b).toUpperCase())
                return 0;
            else
                return -1;
        });
        this.menu.addMenuItem(menuItem, pos);
        return menuItem;
    },

    /*
     * create popoup menu item with callback
     */
    _createAppItem: function(appInfo, callback) {
        let menuItem = new PopupGiconMenuItem(appInfo.get_name(), appInfo.get_icon(), {});
        menuItem.connect('activate', Lang.bind(this, function (menuItem, event) {
                    callback(menuItem, event);
                }));

        return menuItem;
    },

    /*
     * add "new app"-dialog link to popup menu
     */
    _setupNewDialog: function() {
        let item = new PopupMenu.PopupSeparatorMenuItem();
        this.menu.addMenuItem(item);
        item = new PopupMenu.PopupMenuItem(_("Create new launcher..."));
        item.connect('activate', Lang.bind(this, function(){
            if (!this._appDirectory.query_exists(null))
                return;
            // create filename
            let uuid = this._createUUID();
            let uuidDesktopPath = GLib.build_filenamev([AppsPath, uuid+'.desktop']);
            Util.trySpawn( ['gnome-desktop-item-edit', uuidDesktopPath ]);
        }));
        this.menu.addMenuItem(item);
    },

    /*
     * thanks stackoverflow:
     */
    _createUUID: function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
    },

};

/*
 * Extension Setup
 */
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
