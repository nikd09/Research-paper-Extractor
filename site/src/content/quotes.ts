import type { Quote } from './types'

/**
 * These are reconstructions, drafted from the real bug history and timeline
 * and awaiting Nik's edit. The facts in them are real; the feelings are a
 * best guess at what fits those facts. Every one renders with a visible
 * draft marker until he says otherwise — flip `status` to 'approved' and the
 * marker disappears.
 */
export const QUOTES: Record<string, Quote> = {
  confidentlyWrong: {
    id: 'confidently-wrong',
    prompt: 'The moment the pipeline was confidently wrong',
    status: 'draft-reconstruction',
    body: [
      'It was the crosscheck bug. I had a paper’s real PPS wear rate — 6.6E-6 — sitting correctly in one entry, and a fabricated 6.6E-7 sitting right next to it in the same field. Ten times off. The pipeline had passed both. Not flagged, not hedged — passed, because my crosscheck logic checked whether anything in the field matched between the two extractions, and something did, so it cleared the whole field.',
      'I only found it because I had the PDF open next to the output, checking by hand, the way I’d been telling myself I didn’t need to do anymore once the architecture got better. That’s the part that actually got to me — it wasn’t a weird edge case, it was sitting in normal-looking output, formatted exactly like every correct value around it. If I hadn’t been reading the source paper at the same time I would never have caught it. That’s when “the pipeline ran without errors” stopped meaning anything to me.',
    ],
  },
  costliestBug: {
    id: 'costliest-bug',
    prompt: 'The bug that cost the most time',
    status: 'draft-reconstruction',
    body: [
      'The escalation one — a value stated plainly in the paper’s own text getting erased to “Not Reported” by the model I’d built specifically to rescue flagged values. That one took a while to trace because every individual piece looked correct. The validator did its job. Escalation ran. Pro followed its instructions. The log was clean the entire way through.',
      'I found it by working backward from a missing value I knew was in the source — I’d read it myself. Traced it through the pipeline stage by stage and found the validator had flagged it unverified because 2.0 × 10⁻⁵ and 2.0E-5 didn’t string-match, and then escalation — which I’d only ever given the figures, not the text — went looking for it in a chart it was never going to find it in, and did exactly what I told it to do when a value can’t be confirmed: wrote “Not Reported” over a correct answer. I built the thing that destroyed the data by following my own instructions correctly. That’s a specific kind of frustrating.',
    ],
  },
  wrongBelief: {
    id: 'wrong-belief',
    prompt: 'What I believed at the start that turned out to be wrong',
    status: 'draft-reconstruction',
    body: [
      'That a better-designed architecture would just produce better output. I built Run 3 to fix everything wrong with Run 2 — figure-targeted verification instead of whole-document, a deterministic validator, cross-model checking, escalation instead of an unconditional Pro pass. Every decision was defensible. And when I actually compared the two against the source papers, Run 2 — the blunt, expensive, un-triaged version — had caught things Run 3 missed.',
      'That one rearranged how I think about this kind of system. A gate is only as good as its discriminator, and “the architecture is better” is a hypothesis about the diagram, not a fact about the output. I don’t think I really believed that until Run 3 proved it to me by being wrong.',
    ],
  },
  whyItMatters: {
    id: 'why-it-matters',
    prompt: 'Why citation reliability matters here specifically',
    status: 'draft-reconstruction',
    body: [
      'Because this isn’t a demo. The extracted knowledge feeds an agent that engineers at Saint-Gobain actually query when they’re choosing a sliding-layer material for a real part — a seat recliner pivot bushing with a real spec, benchmarked against Saint-Gobain’s own product. If the agent tells someone a candidate material’s wear rate is 6.6E-7 mm³/Nm and the real number is 6.6E-6, that’s not a rounding error, that’s a material that looks ten times better than it is. Someone could actually pick it.',
      'And there’s a specific reason I built the whole thing around never guessing: an earlier internal Copilot agent had exactly this gap — confident answers nobody could trace back to a source. I watched that erode trust in the tool. An engineer who gets burned once by an untraceable wrong number stops trusting the system entirely, and then you’ve built something nobody uses. A missing value costs someone ten minutes with a PDF. A confidently wrong one costs a material decision. That asymmetry is the entire design brief.',
    ],
  },
  proudOf: {
    id: 'proud-of',
    prompt: 'The part I’m actually proud of',
    status: 'draft-reconstruction',
    body: [
      'The precedence logic. Not the flashiest part of the pipeline, but it’s four lines — if a value is already confirmed by the deterministic text check, the crosscheck stage isn’t allowed to touch it, because a verbatim match in the source text is stronger evidence than two AI models agreeing with each other. That took me a while to actually get right, and once I did it changed how the whole system behaves: the layers don’t just run in sequence, they defer to each other based on how strong their evidence actually is. Most systems I’ve seen just let whichever check ran last win. Getting that ordering to mean something instead of just being an order is the piece I’d point at first.',
    ],
  },
  differently: {
    id: 'differently',
    prompt: 'What I’d build differently starting again tomorrow',
    status: 'draft-reconstruction',
    body: [
      'The domain layer. Right now the seat-recliner-specific stuff — the field names, the PFAS compliance flag, the metric field lists — is scattered across the schema and copy-pasted into three separate verification modules. It works, but retargeting this to a different domain right now means editing five files and hoping I got all three copies of that field list in sync. I’d build the domain pack concept from day one instead of bolting it on after: one folder holding the prompts, the metric definitions, the relevance targets, the compliance rules, so switching from a seat recliner bushing to something like a slotted-rib bearing design is a config swap, not a refactor. I designed it that way eventually. I just didn’t design it that way first.',
    ],
  },
}
