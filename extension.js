/* vim: ts=4 sw=4
 */
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const St = imports.gi.St;
const Main = imports.ui.main;
const Shell = imports.gi.Shell;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Lang = imports.lang;
const FileUtils = imports.misc.fileUtils;

const AppsPaths = [ GLib.get_home_dir() + '/.local/user/apps',
    GLib.get_home_dir() + '/.local/share/gnome-shell/quicklaunch',
];


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

        this.defaultItems = [];
        for (let path in AppsPaths)
            this._createDefaultApps(AppsPaths[path]);
        this._addDialog();
    },

    /*
     * load desktop files from a directory
     */
    _createDefaultApps: function(appsPath) {
        let _appsDir = Gio.file_new_for_path(appsPath);
        if (!_appsDir.query_exists(null)) {
            global.log('App path ' + appsPath + ' could not be opened!');
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
                let desktopPath =  appsPath + '/' + name;
                this.defaultItems[i] = this._addAppItem(desktopPath);
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
    _addDialog: function() {
        /*
        let item = new PopupMenu.PopupSeparatorMenuItem();
        this.menu.addMenuItem(item);
        item = new PopupMenu.PopupMenuItem(_("Create new launcher...")),
        this.menu.addMenuItem(item);
        */
    }
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
