# Panel Pin

This convenient extension automatically moves the bottom panel (Problems, Output, Debug Console, Terminal etc) out the way automatically to increase editor height whilst keeping the panel handily in reach.

## Usage

Adds a pin icon to collapse the bottom panel when a code editor window gets focus.

By default, Panel Pin shows both a status bar button and title-bar buttons on a configurable list of panel views. The button icon switches between pinned and unpinned states.

![Title Bar](https://brianhearncom.blob.core.windows.net/vscode-panel-pin/title-bar.png?v=2)

![Bottom Panel](https://brianhearncom.blob.core.windows.net/vscode-panel-pin/bottom-panel.png?v=2)

When **unpinned** automatically resizes the bottom panel to its **smallest size** when the code editor gets focus without toggling its visibility.

![Status Bar](https://brianhearncom.blob.core.windows.net/vscode-panel-pin/unpinned.png?v=2)

The panel must be resized manually to restore its height.

When **pinned** the panel remains at its set height.

## Button Placement

The title-bar buttons are contributed to panel views through `view/title`. They are right-aligned in VS Code's `navigation` group, which is the closest supported placement to the built-in view controls.

The default view list is:

- Problems (`workbench.panel.markers.view`)
- Output (`workbench.panel.output`)
- Debug Console (`workbench.panel.repl.view`)
- Ports (`~remote.forwardedPorts`)
- Terminal (`terminal`)

You can add other view ids in `panelPin.titleBarViewIds` if you want the button to appear elsewhere.

To discover a panel or view id:

1. Run **Developer: Toggle Developer Tools**.
2. Open the **Console** tab.
3. Run **Developer: Inspect Context Keys**.
4. Click the panel or view title area you want to inspect.
5. Inspect the logged object in the console and look for keys such as `view`, `focusedView`, or `activePanel`.

VS Code does not expose a supported extension API for iterating every currently available view id and auto-injecting buttons into them.

## Settings

Command Pallete: `Preferences: Open User Settings` and fiter to `panelpin`

- `panelPin.showStatusBarPinButton`: controls the status bar button. Default: `true`.
- `panelPin.showPanelTitlePinButton`: controls the built-in panel view title buttons. Default: `true`.
- `panelPin.titleBarViewIds`: list of view ids that should show the title-bar button. Default: Problems, Output, Debug Console, Ports, and Terminal.