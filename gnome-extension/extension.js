/* Nexus Plasm GNOME Shell Extension
 *
 * Provides global shortcuts and clipboard integration for nexus-plasm.
 */

const { St, Clutter, GLib, GObject } = imports.gi;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Shell = imports.gi.Shell;

const PLASM_BIN = GLib.find_program_in_path('plasm') || '/usr/local/bin/plasm';

const EXTENSION_DIR = imports.misc.extensionUtils.getCurrentExtension().path;

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, _('Nexus Plasm'), false);

        this._stackSize = 0;
        this._hasImage = false;
        this._updateInterval = null;

        this.add_child(new St.Icon({
            icon_name: 'edit-paste-symbolic',
            style_class: 'system-status-icon'
        }));

        this._buildMenu();
        this._startPolling();
    }

    _buildMenu() {
        this._statusItem = new PopupMenu.PopupMenuItem(_('Status: loading...'));
        this.menu.addMenuItem(this._statusItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const pushItem = new PopupMenu.PopupMenuItem(_('Push Clipboard to Stack'));
        pushItem.connect('activate', () => this._execPlasm(['push']));
        this.menu.addMenuItem(pushItem);

        const popItem = new PopupMenu.PopupMenuItem(_('Paste Last Item'));
        popItem.connect('activate', () => this._execPlasm(['pop']));
        this.menu.addMenuItem(popItem);

        const processItem = new PopupMenu.PopupMenuItem(_('Process Last (fix-pt)'));
        processItem.connect('activate', () => this._execPlasm(['process', '--preset', 'fix-pt']));
        this.menu.addMenuItem(processItem);

        const processAllItem = new PopupMenu.PopupMenuItem(_('Process All (fix-pt)'));
        processAllItem.connect('activate', () => this._execPlasm(['process-all', '--preset', 'fix-pt']));
        this.menu.addMenuItem(processAllItem);

        const pasteAllItem = new PopupMenu.PopupMenuItem(_('Paste All'));
        pasteAllItem.connect('activate', () => this._execPlasm(['paste-all']));
        this.menu.addMenuItem(pasteAllItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const statusItem = new PopupMenu.PopupMenuItem(_('Show Status'));
        statusItem.connect('activate', () => this._execPlasm(['status']));
        this.menu.addMenuItem(statusItem);

        const daemonItem = new PopupMenu.PopupMenuItem(_('Start Daemon'));
        daemonItem.connect('activate', () => this._execPlasm(['daemon']));
        this.menu.addMenuItem(daemonItem);

        const stopItem = new PopupMenu.PopupMenuItem(_('Stop Daemon'));
        stopItem.connect('activate', () => this._execPlasm(['stop']));
        this.menu.addMenuItem(stopItem);
    }

    _execPlasm(args) {
        try {
            const [success, out, err, exit] = GLib.spawn_sync(
                null,
                [PLASM_BIN, ...args],
                null,
                GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                null
            );

            if (success && exit === 0) {
                const text = out.toString().trim();
                if (text) {
                    this._statusItem.label.set_text(text.slice(0, 60));
                }
                this._refreshStatus();
            } else {
                this._statusItem.label.set_text(_('Error: ') + (err.toString().trim().slice(0, 40) || 'exit=' + exit));
            }
        } catch (e) {
            this._statusItem.label.set_text(_('Plasm not found'));
        }
    }

    _refreshStatus() {
        try {
            const [success, out] = GLib.spawn_sync(
                null,
                [PLASM_BIN, 'status'],
                null,
                GLib.SpawnFlags.SEARCH_PATH,
                null
            );

            if (success) {
                const raw = out.toString().trim();
                try {
                    const data = JSON.parse(raw);
                    this._stackSize = Number(data.stackSize || 0);
                    this._hasImage = Boolean(data.hasImage);
                    this._statusItem.label.set_text(
                        _('Stack: ') + this._stackSize + (_(' | Image: ') + (this._hasImage ? _('yes') : _('no')))
                    );
                } catch {
                    this._statusItem.label.set_text(raw.slice(0, 60));
                }
            }
        } catch {
            // ignore
        }
    }

    _startPolling() {
        this._refreshStatus();
        this._updateInterval = setInterval(() => {
            this._refreshStatus();
        }, 2000);
    }

    destroy() {
        if (this._updateInterval !== null) {
            clearInterval(this._updateInterval);
            this._updateInterval = null;
        }
        super.destroy();
    }
});

class NexusPlasmExtension {
    constructor(metadata) {
        this._indicator = null;
        this._keybindings = new Map();
    }

    enable() {
        this._indicator = new Indicator();
        Main.panel.addToStatusArea('nexus-plasm', this._indicator);

        this._bindKey('<Super>x', ['process', '--preset', 'fix-pt']);
        this._bindKey('<Super>f', ['process-all', '--preset', 'fix-pt']);
        this._bindKey('<Super><Alt>v', ['paste-all']);
        this._bindKey('<Super>v', ['pop']);
        this._bindKey('<Control>c', ['push']);
        this._bindKey('<Super>b', ['status']);
    }

    _bindKey(binding, args) {
        Main.wm.addKeybinding(
            binding,
            new St.Keybinding(
                St.KeybindingType.NORMAL,
                binding,
                _('Nexus Plasm: ') + args.join(' ')
            ),
            Shell.ActionMode.NORMAL,
            () => {
                if (this._indicator) {
                    this._indicator._execPlasm(args);
                }
            }
        );
        this._keybindings.set(binding, args);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }

        for (const binding of this._keybindings.keys()) {
            Main.wm.removeKeybinding(binding);
        }
        this._keybindings.clear();
    }
}

function init(meta) {
    return new NexusPlasmExtension(meta);
}
