// Insider as a native macOS app: one window with a WebKit view showing index.html, no browser around it.
// install_app.sh compiles this into Insider.app and writes the game folder's path into its Info.plist (GameFolder).
import Cocoa
import WebKit

class AppDelegate: NSObject, NSApplicationDelegate {
  var window: NSWindow!

  func applicationDidFinishLaunching(_ notification: Notification) {
    let folder = URL(fileURLWithPath: Bundle.main.object(forInfoDictionaryKey: "GameFolder") as! String)
    let config = WKWebViewConfiguration()
    let web = WKWebView(frame: .zero, configuration: config)
    web.loadFileURL(folder.appendingPathComponent("index.html"), allowingReadAccessTo: folder)

    window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1440, height: 900),
                      styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
    window.title = "Insider"
    window.contentView = web
    window.setFrameAutosaveName("Insider")
    if !window.setFrameUsingName("Insider") { window.center() }
    window.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
// The standard app menu, so Cmd+Q and Cmd+H work, and an Edit menu so Cmd+C/V work in the page.
let menu = NSMenu()
let appItem = NSMenuItem(); menu.addItem(appItem)
let appMenu = NSMenu()
appMenu.addItem(withTitle: "Hide Insider", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
appMenu.addItem(withTitle: "Quit Insider", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
appItem.submenu = appMenu
let editItem = NSMenuItem(); menu.addItem(editItem)
let editMenu = NSMenu(title: "Edit")
editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
editItem.submenu = editMenu
let windowItem = NSMenuItem(); menu.addItem(windowItem)
let windowMenu = NSMenu(title: "Window")
windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
windowMenu.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
windowItem.submenu = windowMenu
app.mainMenu = menu
app.run()
