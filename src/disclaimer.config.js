export const DISCLAIMER = {
  // Modal heading. Keep under ~60 chars so it stays on one line at 560px.
  title: "Supporting documents",

  // The note. Array of paragraphs — each entry renders as its own <p>.
  // Keep to 2 short paragraphs; anything longer pushes the link list below the fold.
  note: [
    "Dear Evaluator(s) — I submitted my grad project at 3:55 pm and made the mistake of not double-checking the exported PDF. The deck came out with black bars above and below every slide, cutting down the dimensions of the actual slides, and none of the links in it were clickable.",
    "That was my error for not finishing in time to check it diligently, and I sincerely hope it does not become an impediment to a fair evaluation of my work — I have put my heart and soul into this (and a lot of tokens!). Through this panel I am sharing all the supporting assets I had wanted to share through the deck. Thank you."
  ],

  // Groups render as labelled sections. Use one group if you don't want headings.
  groups: [
    {
      heading: "Research",
      links: [
        { label: "Survey responses", url: "https://docs.google.com/spreadsheets/d/1F99luon4xXkAhGx34TPl9VbZtfAgQZ8iKfncLfWZFqM/edit", type: "sheet" },
        { label: "Questionnaire for in-depth interviews", url: "https://docs.google.com/document/d/1GVaggs5IOiEFguJJZywnl4Msg-qY5uOa8PEcYwvKq_I/edit", type: "doc" },
        { label: "Transcripts from interviews", url: "https://docs.google.com/document/d/1w5umL6LVZtTKGCf0USNheLDRU6PNghq8a4fCebCtfSc/edit", type: "doc" },
        { label: "Customer journey", url: "https://miro.com/app/board/uXjVH24walQ=/?share_link_id=716911892545", type: "miro" }
      ]
    },
    {
      heading: "References",
      links: [
        { label: "Sources cited on slide 1", url: "https://docs.google.com/document/d/1MbVZuo4gSFzd-ge71Wt4xi2gcFDaMspTNygzJsiMRdc/edit", type: "doc" }
      ]
    }
  ],

  // Small print under the link list. Set to null to hide.
  footerNote: "All documents are open to anyone with the link.",

  // See §1. Leave false for open-on-every-load.
  suppressWithinSession: false
};

// Badge text by type. Add types here if you need more.
export const TYPE_LABELS = {
  doc:    "Google Doc",
  sheet:  "Google Sheet",
  slides: "Google Slides",
  miro:   "Miro",
  github: "GitHub",
  pdf:    "PDF",
  app:    "Live app",
  form:   "Form",
  link:   "Link"
};
