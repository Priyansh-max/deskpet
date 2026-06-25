//! Minimal Win32 interop for taskbar placement, keep-on-top, and fullscreen
//! detection. Uses our own `windows` crate version; the HWND is passed in as a
//! raw isize so it is independent of whichever `windows` version Tauri uses.
use core::ffi::c_void;
use windows::core::PCWSTR;
use windows::Win32::Foundation::{ERROR_FILE_NOT_FOUND, HWND, RECT};
use windows::Win32::System::Registry::{
    RegDeleteKeyValueW, RegSetKeyValueW, HKEY_CURRENT_USER, REG_SZ,
};
use windows::Win32::UI::WindowsAndMessaging::{
    FindWindowExW, FindWindowW, GetClassNameW, GetForegroundWindow, GetWindowRect, SetWindowPos,
    HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
};

pub fn hwnd_from_raw(raw: isize) -> HWND {
    HWND(raw as *mut c_void)
}

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// The primary taskbar window rectangle, in physical pixels.
pub fn taskbar_rect() -> Option<RECT> {
    unsafe {
        let class = wide("Shell_TrayWnd");
        let hwnd = FindWindowW(PCWSTR(class.as_ptr()), PCWSTR::null()).ok()?;
        let mut rect = RECT::default();
        GetWindowRect(hwnd, &mut rect).ok()?;
        Some(rect)
    }
}

/// Taskbar rectangle for a given monitor index (0 = primary), in physical px.
///
/// Each secondary monitor has its own `Shell_SecondaryTrayWnd`; we enumerate
/// them in Z-order and pick by index. Ordering isn't guaranteed to follow the
/// OS monitor numbering, so this is best-effort and falls back to the primary
/// taskbar when the index can't be resolved.
pub fn taskbar_rect_for(monitor: u32) -> Option<RECT> {
    if monitor == 0 {
        return taskbar_rect();
    }
    unsafe {
        let class = wide("Shell_SecondaryTrayWnd");
        let mut prev = HWND::default();
        let mut idx = 1u32;
        while let Ok(hwnd) =
            FindWindowExW(HWND::default(), prev, PCWSTR(class.as_ptr()), PCWSTR::null())
        {
            if idx == monitor {
                let mut rect = RECT::default();
                if GetWindowRect(hwnd, &mut rect).is_ok() {
                    return Some(rect);
                }
                break;
            }
            prev = hwnd;
            idx += 1;
        }
    }
    taskbar_rect()
}

/// Re-assert the window above the taskbar without activating it.
pub fn set_topmost(hwnd: HWND) {
    unsafe {
        let _ = SetWindowPos(
            hwnd,
            HWND_TOPMOST,
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
        );
    }
}

const SHELL_CLASSES: [&str; 4] = ["WorkerW", "Progman", "Shell_TrayWnd", "Shell_SecondaryTrayWnd"];

/// True when the foreground window fully covers the given monitor rect (a real
/// fullscreen app *on that monitor*, not merely maximized — which leaves the
/// taskbar free — and ignoring the shell/desktop windows). The rect is the
/// chip's own monitor in physical px, so a fullscreen app on a *different*
/// monitor doesn't hide the chip, and resolution differences are handled.
pub fn foreground_covers(own: HWND, left: i32, top: i32, right: i32, bottom: i32) -> bool {
    unsafe {
        let fg = GetForegroundWindow();
        if fg.0.is_null() || fg == own {
            return false;
        }
        let mut buf = [0u16; 256];
        let len = GetClassNameW(fg, &mut buf);
        if len > 0 {
            let cls = String::from_utf16_lossy(&buf[..len as usize]);
            if SHELL_CLASSES.contains(&cls.as_str()) {
                return false;
            }
        }
        let mut rect = RECT::default();
        if GetWindowRect(fg, &mut rect).is_err() {
            return false;
        }
        rect.left <= left && rect.top <= top && rect.right >= right && rect.bottom >= bottom
    }
}

const RUN_KEY: &str = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
const AUTOSTART_VALUE: &str = "DeskPet";

/// Enable or disable launch-at-login by writing/removing the per-user
/// `...\CurrentVersion\Run` registry value. Writing also refreshes the stored
/// path, which matters after the app is updated/moved. Returns whether the
/// registry operation succeeded.
pub fn set_autostart(enable: bool) -> bool {
    let subkey = wide(RUN_KEY);
    let name = wide(AUTOSTART_VALUE);
    unsafe {
        if enable {
            let exe = match std::env::current_exe() {
                Ok(p) => p,
                Err(_) => return false,
            };
            // Quote the path so an install path containing spaces still launches.
            let data = wide(&format!("\"{}\"", exe.display()));
            let cbdata = (data.len() * std::mem::size_of::<u16>()) as u32;
            RegSetKeyValueW(
                HKEY_CURRENT_USER,
                PCWSTR(subkey.as_ptr()),
                PCWSTR(name.as_ptr()),
                REG_SZ.0,
                Some(data.as_ptr() as *const c_void),
                cbdata,
            )
            .0 == 0
        } else {
            let err = RegDeleteKeyValueW(
                HKEY_CURRENT_USER,
                PCWSTR(subkey.as_ptr()),
                PCWSTR(name.as_ptr()),
            );
            // An already-absent value counts as "successfully disabled".
            err.0 == 0 || err.0 == ERROR_FILE_NOT_FOUND.0
        }
    }
}
