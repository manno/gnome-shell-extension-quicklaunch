/* vim: ts=4 sw=4
 */
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as FileUtils from 'resource:///org/gnome/shell/misc/fileUtils.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
// for lowerBound; import * as Util from 'resource:///org/gnome/shell/misc/util.js';
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";

const AppsPath = GLib.get_home_dir() + '/.local/share/gnome-shell/quicklaunch';
const AppsPaths = [ GLib.get_home_dir() + '/.local/user/apps', AppsPath ];

const IndicatorName = 'QuickLaunch';

/**
 * Gicon Menu Item Object
 */
let PopupGiconMenuItem = GObject.registerClass(
class PopupGiconMenuItem extends PopupMenu.PopupBaseMenuItem {
    _init(text, gIcon, params) {
        super._init(params);

        this.label = new St.Label({ text: text });
        this._icon = new St.Icon({
                gicon: gIcon,
                style_class: 'popup-menu-icon' });
        this.add_actor(this._icon);
        this.add_actor(this.label);
    }
});

/**
 * QuickLaunch Object
 */
let QuickLaunch = GObject.registerClass(
class QuickLaunch extends PanelMenu.Button {

    _init() {
        super._init( 0.0, IndicatorName );

        this._icon = new St.Icon({ icon_name: 'user-bookmarks-symbolic', style_class: 'system-status-icon' });
        this.add_actor(this._icon);
        this.add_style_class_name('panel-status-button');

        this.connect('destroy', () => this.onDestroy());
        this._setupDirectory();
        this._setupAppMenuItems();
        this._setupDirectoryMonitor();
    }

    _onDestroy() {
        this._monitor.cancel();
        GLib.source_remove(this._appDirectoryTimeoutId);
    }

    /**
     * create dir unless exists
     */
    _setupDirectory() {
        let dir = Gio.file_new_for_path(AppsPath);
        if (!dir.query_exists(null)) {
            global.log('create dir ' + AppsPath );
            dir.make_directory_with_parents(null);
        }
        this._appDirectory = dir;
    }

    /**
     * reload the menu
     */
    _reloadAppMenu() {
        this.menu.removeAll();
        this._setupAppMenuItems();
    }

    /**
     * change directory monitor, see placeDisplay.js
     */
    _setupDirectoryMonitor() {
        if (!this._appDirectory.query_exists(null))
            return;
        this._monitor = this._appDirectory.monitor_directory(Gio.FileMonitorFlags.NONE, null);
        this._appDirectoryTimeoutId = 0;
        this._monitor.connect('changed', () => {
            if (this._appDirectoryTimeoutId > 0)
                return;
            /* Defensive event compression */
            this._appDirectoryTimeoutId = GLib.timeout_add(100, () => {
                this._appDirectoryTimeoutId = 0;
                this._reloadAppMenu();
                return false;
            });
        });
    }

    /**
     * setup menu items for all desktop files
     */
    _setupAppMenuItems(path) {
        for (let path in AppsPaths)
            this._createDefaultApps(AppsPaths[path]);
    }

    /**
     * load desktop files from a directory
     */
    _createDefaultApps(path) {
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
    }


    /**
     * From shell/js/misc/util.js as lowerBound is for some reason not exported
     */
    lowerBound(array, val, cmp) {
        let min, max, mid, v;
        cmp ||= (a, b) => a - b;

        if (array.length === 0)
            return 0;

        min = 0;
        max = array.length;
        while (min < (max - 1)) {
            mid = Math.floor((min + max) / 2);
            v = cmp(array[mid], val);

            if (v < 0)
                min = mid + 1;
            else
                max = mid;
        }

        return min === max || cmp(array[min], val) < 0 ? max : min;
    }

    /**
     * add menu item to popup
     */
    _addAppItem(desktopPath) {
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
        let pos = /* Util. */ this.lowerBound(this.menu._getMenuItems(), sortKey, function (a,b) {
            if (String(a.label.text).toUpperCase() > String(b).toUpperCase())
                return 0;
            else
                return -1;
        });
        this.menu.addMenuItem(menuItem, pos);
        return menuItem;
    }

    /**
     * create popoup menu item with callback
     */
    _createAppItem(appInfo, callback) {
        let menuItem = new PopupGiconMenuItem(appInfo.get_name(), appInfo.get_icon(), {});
        menuItem.connect('activate', (menuItem, event) => {
                    callback(menuItem, event);
        });

        return menuItem;
    }

});


/**
 * Extension Setup
 */
export default class QuickLaunchExtension extends Extension
{
    constructor(metadata)
    {
        super(metadata);

        this._indicator = null;
    }

    enable() {
        this._indicator = new QuickLaunch();
        Main.panel.addToStatusArea(IndicatorName, this._indicator);
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
    }
}
