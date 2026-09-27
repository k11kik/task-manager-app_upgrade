# NavFOR — Navigation Focus Objectives & Results

**NavFOR** is an integrated task and project management application featuring hierarchical project organization (**Explorer**), dual-mode Gantt-style scheduling for both calendar dates and custom stages (**Project Timeline**), a multi-tab and split-view editor (**Task / Folder Detail**), and real-time cloud sync paired with a 3-generation rolling local file backup.

---

## Table of Contents

1. [Overall Screen Layout (3-Pane Architecture)](#1-overall-screen-layout-3-pane-architecture)
2. [Explorer (Left Pane: Hierarchical Folders & Focus Management)](#2-explorer-left-pane-hierarchical-folders--focus-management)
3. [Adding Tasks, Focus (Priority Slots), & Daily Pick](#3-adding-tasks-focus-priority-slots--daily-pick)
4. [Project Timeline (Center Pane: Schedule & Phase Management)](#4-project-timeline-center-pane-schedule--phase-management)
5. [Mobile Landscape Mode (Fullscreen / Full App View Toggle)](#5-mobile-landscape-mode-fullscreen--full-app-view-toggle)
6. [Task & Folder Detail (Right Pane: Multi-Tab & Split Detail Editor)](#6-task--folder-detail-right-pane-multi-tab--split-detail-editor)
7. [Calendar / Archive / Trash & Auto Sweep](#7-calendar--archive--trash--auto-sweep)
8. [Local Log Sync (Rolling 3-File Auto-Overwrite Backup)](#8-local-log-sync-rolling-3-file-auto-overwrite-backup)
9. [Keyboard Shortcuts](#9-keyboard-shortcuts)
10. [Run Locally (Setup & Build)](#10-run-locally-setup--build)

---

## 1. Overall Screen Layout (3-Pane Architecture)

The **Dashboard** (main workspace view) uses an IDE-inspired **3-pane architecture**. You can drag the border dividers between panes to resize them freely, or collapse panes when you need extra screen space.

| Area | Name | Primary Role |
| :--- | :--- | :--- |
| **Top Bar** | **Header & Workspaces** | Workspace switching, view navigation (Dashboard / Calendar / Archive / Trash / Settings), Undo/Redo, project filters, local sync status indicator, and User Guide (`Guide`) |
| **Left Pane** | **Explorer** | Top-priority `Focus` task slots, approaching deadline alerts, and the hierarchical project folder & task tree |
| **Center Pane** | **Project Timeline** | Cross-project schedule visualization and interactive editing in either calendar date mode (`Dates`) or custom stage mode (`Phase 1–5`, etc.) |
| **Right Pane** | **Task / Folder Detail** | Rich inspector for selected tasks and folders (supports multiple open tabs and up to 4-way split views: Left/Right, Top/Bottom, or 2x2 Grid) |

---

## 2. Explorer (Left Pane: Hierarchical Folders & Focus Management)

The left **Explorer** pane organizes your tasks into project folders and nested subfolders of any depth.

### Key Features
- **Hierarchical Folder Management**:
  - Create nested subfolders to any depth using `/` separators (e.g., `ProjectA/UI/Components`) or via the **Create Subfolder** action in any folder menu.
  - **Drag & Drop Organization**: Drag tasks between folders, or drop a folder onto another folder to nest it as a subfolder (drop onto the Explorer header bar to move a subfolder back to the root level).
- **Context Menu (`...` Button) & Inline Actions**:
  - Open the `...` menu on any folder or task to **Rename**, **Add New Task**, **Create Subfolder**, **Star**, **Pin**, **Duplicate**, or **Move to Archive / Trash**.
  - **Folder Duplication**: Duplicating a folder recursively copies its entire subfolder tree and all contained tasks at once.
  - **Automatic Parent Deadline Calculation**: Parent folders automatically compute and display the earliest upcoming deadline among their child tasks and subfolders.
- **Resizable & Collapsible Pane**:
  - Drag the right border of the Explorer to adjust its width, or click the collapse icon in the Explorer header to minimize it into a slim vertical bar.

---

## 3. Adding Tasks, Focus (Priority Slots), & Daily Pick

### How to Add Tasks
1. **From the Explorer**:
   - Use the quick-input bar at the top of the Explorer, or click the `+` icon next to any folder (or `...` > `New Task`) to create a task directly inside that folder.
2. **Directly on the Project Timeline (Quick Create)**:
   - **Double-click** any empty cell on the Timeline (a specific date/time slot, a custom Phase step, or the ToDo List column) to immediately create a task pre-scheduled for that exact slot and project lane.
   - You can also click the `+` button next to any project lane title.

### Focus (Priority Tasks) & Daily Pick
- **Focus Section**:
  - Pin your most critical, high-impact tasks (up to 3 active slots recommended) to the **Focus** section (marked with a red lightning bolt ⚡) at the very top of the Explorer.
- **Daily Pick Modal**:
  - Click the `+ Pick` button in the Focus header to open the **Daily Pick** modal, allowing you to review your active tasks and promote today's priorities into Focus with a single click.
- **Deadline Alerts**:
  - Tasks with approaching deadlines (within 3 days by default) are highlighted in yellow, while overdue tasks are highlighted with a red clock icon and badge.

---

## 4. Project Timeline (Center Pane: Schedule & Phase Management)

The center **Project Timeline** displays each project folder as a horizontal **Project Lane (row)** so you can manage task execution order, durations, and dependencies across all projects simultaneously.

### Two Timeline Modes
1. **Calendar Date Mode (`Dates`)**:
   - Uses real calendar dates along the horizontal axis (`7 Days` / `14 Days` / `21 Days` views, with `◀ Today ▶` navigation).
   - Displays duration bars spanning from each task's **Start Date/Time** to **Deadline Date/Time**, a live current-time indicator line, and recurring task occurrences (daily, weekly, etc.).
   - **Interactive Bar Edge Dragging**: Drag the left or right edge of any task bar on the timeline to adjust its start date or deadline directly.
2. **Custom Period / Stage Mode (`Custom / Stages`)**:
   - Organizes tasks across abstract project phases (default: `Phase 1` through `Phase 5`) without requiring fixed calendar dates.
   - Click `+ Add Column` to add more stages, **double-click** any column header to rename it (e.g., `Planning`, `Implementation`, `Review`), or click `Reset Columns` to restore defaults.

### Grid Granularity & ToDo List Column
- **Grid ON / OFF & Sub-Step Granularity**:
  - In `Dates` mode, toggle sub-day time grids (**1h / 2h / 4h / 6h / 12h / 24h** intervals).
  - In `Custom / Stages` mode, subdivide each Phase into **2 to 5 steps** to represent sequential order within a stage.
- **ToDo List Column (Unscheduled Backlog)**:
  - Toggle the `ToDo List` column from the toolbar. Unscheduled tasks are grouped by project lane (with incomplete tasks automatically sorted above completed ones) and can be dragged and dropped directly onto any timeline date or phase slot.
- **Resizable Column Widths**:
  - Drag the right border of the `Project Lanes` column, `ToDo List` column, or any `Phase` column to resize widths freely (use `Reset Widths` to restore default widths).
- **Automatic Execution Order Numbering**:
  - Incomplete tasks within each project lane are automatically numbered in chronological / phase order so the next action is always clear.

---

## 5. Mobile Landscape Mode (Fullscreen / Full App View Toggle)

To maximize workspace visibility on smartphones and compact screens, the Project Timeline includes a dedicated **Fullscreen Mode**.

- **Automatic Fullscreen in Mobile Landscape**:
  - Rotating a mobile device into landscape orientation automatically hides the top navigation bar, bottom navigation bar, Timeline toolbar (`Dates`, `Add Folder`, etc.), and the `ToDo List` column so the Timeline fills the entire screen. Rotating back to portrait automatically restores the standard full-app layout.
- **One-Tap Toggle Between Fullscreen & Full App View**:
  - **Tap the Timeline Date / Stage Header Bar** at the top of the timeline at any time to toggle between **Fullscreen** and **Full App View**.
  - You can also use the **floating button in the bottom-right corner** (`Full App` / `Fullscreen`) or the `Fullscreen` button in the timeline toolbar.
  - While in Fullscreen mode, the bottom-right floating control bar lets you navigate weeks (`◀ Today ▶`) and toggle the left **`Lanes` (Project Lanes)** column on or off without leaving Fullscreen.
- **Resizable Project Lanes in Fullscreen**:
  - Even in Fullscreen mode, you can touch and drag the right border of the `Project Lanes` column (either in the header or on any lane row) to resize its width smoothly between `56px` and `450px`.

---

## 6. Task & Folder Detail (Right Pane: Multi-Tab & Split Detail Editor)

Clicking any task or folder opens the **Detail Pane** on the right side of the screen (available not only on the Dashboard, but also inside the **Archive** and **Trash** explorer views).

### Multi-Tab & Up to 4-Way Split View
- **Preview vs. Pinned Tabs**:
  - **Single-clicking** a task opens it as a preview tab; **double-clicking** a task (or clicking the pin icon on the tab) pins the tab so it stays open while you inspect other tasks.
- **4 Split-View Layouts**:
  - Use the layout switcher buttons in the Detail pane header to switch between **Single Pane**, **Left/Right Split (2 Columns)**, **Top/Bottom Split (2 Rows)**, and **2x2 Grid Split (4 Panes)**.
  - Drag and drop tabs between split panes to compare or edit multiple tasks and folders side by side.
- **Width Resizing & Minimize**:
  - Drag the left border of the Detail pane to resize its width freely (double-click the border to reset to default width).
  - Click `－` in the top-right corner to minimize the pane into a side strip while keeping all open tabs intact, or `×` to close all tabs.

### Task Detail Fields
- **Core Properties**: Title, parent project folder, completion checkbox, Focus toggle (⚡), Star (★), and Pin (📌).
- **Start Date/Time & Deadline**: Set specific dates and times or toggle `All Day` (automatically validated against parent folder deadlines if configured).
- **Recurrence**: Configure repeating schedules (`None` / `Daily` / `Every N Days` / `Weekly on specific days` / `Every N Weeks`).
- **Phase Assignment**: Assign the task's custom Stage (`Phase`) and sub-step index.
- **Related URLs**: Attach multiple reference links or document URLs and open them with one click.
- **Notes / Memo**: Write detailed notes, markdown checklists, or meeting minutes with automatic saving.

### Folder Detail Inspector
- Clicking a **folder name** in the Explorer or Timeline opens a dedicated **Folder Detail** tab.
- Manage the **Folder Deadline**, **Folder Notes**, overall completion progress bar, and inspect or batch-archive all tasks inside that folder.

---

## 7. Calendar / Archive / Trash & Auto Sweep

- **Calendar (Monthly View)**:
  - Visualizes all workspace tasks (deadlines and recurring occurrences) on a monthly calendar grid. Click any task on the calendar to inspect or edit it.
- **Archive & Trash (Explorer View + Detail Pane)**:
  - Browse and search completed/archived tasks or deleted tasks while preserving their original project folder hierarchy.
  - Clicking a task in Archive or Trash opens the **Task Detail** pane on the right, where you can review its notes, **Restore** it to its original folder, or **Permanently Delete** it.
- **Automatic Cleanup (Auto Sweep in Settings)**:
  - In **Settings > Data Lifecycle**, you can configure automatic cleanup rules:
    - **Auto-Archive Completed Tasks**: Automatically moves completed tasks to Archive after N days (default: **14 days**).
    - **Auto-Delete Trashed Tasks**: Automatically purges tasks that have been in Trash for N days (default: **30 days**).

---

## 8. Local Log Sync (Daily 3-File Rotating Auto-Overwrite Backup)

In addition to real-time cloud persistence (Firebase Firestore), NavFOR supports **automatic daily-rotated local folder CSV backups** using the browser's File System Access API to protect against accidental data loss.

### How It Works & Setup
1. **Initial Folder Selection**:
   - Click the `Local Setting Needed` button in the top header (or go to `Settings` > `Local folder log`) and select a local backup directory on your computer.
2. **Daily 3-File Rotation (`#1` → `#2` → `#3`)**:
   - Once linked, the header steadily displays a green **`Sync Active`** badge.
   - Backups are separated by day across **3 rotating CSV files**: all changes made on the **same day** overwrite that day's numbered file, and on the **next day** NavFOR automatically advances to the next sequential file (`1 → 2 → 3 → 1...`):
     - `NavFOR_Log_<Username>_1.csv`
     - `NavFOR_Log_<Username>_2.csv`
     - `NavFOR_Log_<Username>_3.csv`
3. **Seamless Reconnection Across Browser Restarts**:
   - The directory handle is stored in `IndexedDB`. After restarting your browser, NavFOR checks folder permissions and lets you resume rolling local backups with a single click.
4. **Manual CSV Export & Import**:
   - From `Settings` > `Data Lifecycle`, you can manually download a full CSV snapshot (`Export CSV`) or restore/merge tasks from a CSV file (`Import CSV`) at any time.

---

## 9. Keyboard Shortcuts

When a task or folder is focused in the Explorer or Project Timeline, you can navigate and edit rapidly using keyboard shortcuts:

| Shortcut | Action |
| :--- | :--- |
| `↑` `↓` `←` `→` | **Explorer**: Move up/down the tree, expand folder (`→`), or collapse folder (`←`)<br>**Timeline**: 2D spatial navigation across lanes (up/down) and chronological tasks (left/right) |
| `Space` | Toggle **Completed / Incomplete** status on the selected task |
| `Enter` or `F2` | **Inline Rename** the selected task or folder |
| `Escape` | Cancel inline editing / close active menu / clear selection |
| `Double-Click` | **Empty Timeline Cell**: Create a new task at that date/phase slot<br>**Task / Folder Name**: Start inline rename (and pin open its Detail tab) |

---

## 10. Run Locally (Setup & Build)

**Prerequisites:** Node.js (v18+ recommended)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server (Port 3000):
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```
