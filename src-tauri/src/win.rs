//! Minimal Win32 interop for taskbar placement, keep-on-top, and fullscreen
//! detection. Uses our own `windows` crate version; the HWND is passed in as a
//! raw isize so it is independent of whichever `windows` version Tauri uses.
use core::ffi::c_void;
use windows::core::PCWSTR;
use windows::Win32::Foundation::{HWND, RECT};
use windows::Win32::UI::WindowsAndMessaging::{
    FindWindowW, GetClassNameW, GetForegroundWindow, GetWindowRect, SetWindowPos, HWND_TOPMOST,
    SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
};

pub fn hwnd_from_raw(raw: isize) -> HWND {
    HWND(raw as *mut c_void)
}

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

/// The taskbar window rectangle, in physical pixels.
pub fn taskbar_rect() -> Option<RECT> {
    unsafe {
        let class = wide("Shell_TrayWnd");
        let hwnd = FindWindowW(PCWSTR(class.as_ptr()), PCWSTR::null()).ok()?;
        let mut rect = RECT::default();
        GetWindowRect(hwnd, &mut rect).ok()?;
        Some(rect)
    }
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

/// True when the foreground window covers the whole monitor (a real fullscreen
/// app, not merely maximized — that leaves the taskbar height free).
pub fn is_foreground_fullscreen(own: HWND, mon_w: i32, mon_h: i32) -> bool {
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
        (rect.right - rect.left) >= mon_w && (rect.bottom - rect.top) >= mon_h
    }
}
