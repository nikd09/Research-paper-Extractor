import guiMainIdle from '../assets/gui/gui-main-idle.png'
import guiControls from '../assets/gui/gui-controls.png'
import guiRunning from '../assets/gui/gui-running.png'
import guiKnowledgeBase from '../assets/gui/gui-knowledge-base.png'

export interface GuiStep {
  id: string
  n: string
  kicker: string
  title: string
  image: string
  /** Real pixel dimensions of the source screenshot — used to reserve the
   * correct aspect ratio so nothing letterboxes or forces a uniform width
   * across images that are naturally landscape vs. portrait. */
  width: number
  height: number
  alt: string
  caption: string
}

/**
 * Four real screenshots of the actual desktop GUI (start_gui.py /
 * `Start GUI.bat`), in the order a first run through it goes. No mockups —
 * every pixel here is a real window on a real machine.
 */
export const GUI_STEPS: GuiStep[] = [
  {
    id: 'main-window',
    n: '01',
    kicker: 'Launch',
    title: 'Launch it, and this is what you get',
    image: guiMainIdle,
    width: 945,
    height: 530,
    alt: 'The GUI main window at idle, showing input/output folders, the prompt model dropdown, pipeline stats, and an empty console reading "Ready. Scanning folders..."',
    caption:
      'Start GUI.bat opens this window. The status dot next to the title reads Idle until you start a run. Left side is every control the pipeline needs; right side is where it reports back. Nothing has run yet — the console just confirms it scanned the folders and is waiting.',
  },
  {
    id: 'controls',
    n: '02',
    kicker: 'Configure',
    title: 'Folders, model, and the run controls',
    image: guiControls,
    width: 519,
    height: 771,
    alt: 'Close-up of the input folder, output folder, prompt model dropdown, PDF stats (4 found, 4 already processed, 0 remaining), Rescan Folders, Start Pipeline and Cancel buttons',
    caption:
      'Input Folder and Output Folder each have a Browse button — point one at where your PDFs live, the other at where the JSON/Markdown/chunks should land. Add PDFs lets you pull in files from outside that folder directly. Prompt Model picks which Gemini model runs extraction (gemini-3.6-flash here — see Tab 07 for the free/paid routing behind it). The three counters — PDFs found, already processed, remaining — update on Rescan Folders, so you always know what a run is actually about to do before you click Start Pipeline.',
  },
  {
    id: 'running',
    n: '03',
    kicker: 'Run',
    title: 'A run in progress, and the console that narrates it',
    image: guiRunning,
    width: 945,
    height: 517,
    alt: 'The GUI mid-run: status Running, current paper TRIBOL_1.pdf (2 of 2), ETA 3:23, a progress bar, and a scrolling console log showing each of the five pipeline stages completing in sequence',
    caption:
      'Click Start Pipeline and the right panel takes over: which paper is being processed, how many are left, an ETA, and a progress bar. The console beneath it is the same five checkpoints described on Tab 02, timestamped as they happen — understand-and-extract, verify, crosscheck, escalate, then markdown/chunks — followed by a completion line and the next paper starting. Nothing here is a summary after the fact; it is the pipeline\'s own log, live.',
  },
  {
    id: 'knowledge-base',
    n: '04',
    kicker: 'Synthesize',
    title: 'Knowledge Base: synthesis, once the papers are in',
    image: guiKnowledgeBase,
    width: 750,
    height: 606,
    alt: 'The Knowledge Base panel: a model dropdown reading "Flash -- fast, cheap, good for iterating", a collapsed "Advanced: customize operating envelope" row, and a Build Knowledge Base button',
    caption:
      'Once papers are extracted, this section runs the cross-paper synthesis stage from Tab 05 and Tab 07 — the one that reads every processed paper\'s JSON plus the requirements PDFs and ranks candidate materials. The dropdown is the same flash-vs-pro choice compared on the Case study tab; Advanced lets you override the operating envelope instead of relying on the requirements folder. Build Knowledge Base is the only button in the GUI that can reach the paid tier on purpose, not as a fallback.',
  },
]
