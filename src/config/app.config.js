/**
 * App-wide configuration. Change the app name, strings or tuning here —
 * nothing else in the code hard-codes them.
 */
export const APP = {
  name: 'Cosmic Tales',
  tagline: 'Machines we left among the stars',
  dataUrl: 'data/machines.json',
  storageKeys: { sound: 'cosmic-tales:sound', seenIntro: 'cosmic-tales:intro', narration: 'cosmic-tales:narration', saved: 'cosmic-tales:saved', liked: 'cosmic-tales:liked', lang: 'cosmic-tales:lang' },
  galleryUrl: 'data/gallery.json',
  /** timeline translations (one small file per language, loaded only when picked — see scripts/translate.py) */
  i18nUrl: 'data/i18n/',
  /** "Ask Astro" chat assistant (answers only from data-raw/rag/Data.zip — see scripts/build_rag.py) */
  chat: {
    indexUrl: 'data/rag-index.json',
    /** close back into the astronaut after this long without any interaction (ms) */
    idleMs: 45000,
    /** show the "closing soon" bar for the last part of the idle time (ms) */
    idleWarnMs: 8000,
    width: 380, height: 540,
  },
  /** Timeline voice-over (clips made by `npm run voice`, see scripts/generate_voice.py). */
  narration: {
    manifestUrl: 'data/narration.json',
    defaultVoice: 'astronaut',
    speeds: [0.75, 1, 1.25, 1.5, 2],
    /** pause between one narrated moment and the next in "Play story" (ms) */
    storyGap: 900,
    /** ambient music volume while the narrator talks (0-1 of normal) */
    duckTo: 0.25,
  },
};

/** All user-facing UI strings (ready for a future multi-language layer). */
export const STRINGS = {
  loading: 'Warming up the rocket engines…',
  loadingAssets: 'Loading planets',
  dataNotAvailable: 'Data not available',
  home: 'Solar system',
  homeAria: 'Back to the whole solar system',
  moon: 'Moon',
  mars: 'Mars',
  deepSpace: 'Deep Space',
  searchPlaceholder: 'Search planets, machines, moments…',
  searchAria: 'Search',
  searchCancel: 'Close search',
  noResults: 'Nothing found',
  noResultsHint: 'Try a planet (Mars), a machine (Viking) or a moment (landing).',
  searchGroups: { planet: 'Planets & places', machine: 'Machines & missions', moment: 'Timeline moments' },
  gallery: {
    button: 'Gallery', title: 'Photo gallery', count: (n) => `${n} photos`, close: 'Close gallery',
    open: (name) => `Open photo: ${name}`, prev: 'Previous photo', next: 'Next photo', back: 'Back to all photos',
    pos: (i, n) => `${i} / ${n}`,
    all: 'All photos', liked: 'Liked', like: 'Like', likedLabel: 'Liked',
    likeAria: (name) => `Like photo: ${name}`, unlikeAria: (name) => `Remove like: ${name}`,
    likedToast: 'Added to Liked photos', unlikedToast: 'Removed from Liked photos',
    emptyLiked: 'No liked photos yet. Tap the heart on any photo and it will appear here.',
    error: 'The gallery could not be loaded.',
  },
  saved: {
    button: 'Saved', title: 'Saved items', close: 'Close saved items',
    save: 'Save', saveAria: 'Save this to your saved items',
    ask: 'Where should we save it?', what: 'What to save', thisMoment: (t) => `This moment: “${t}”`, wholeTimeline: (n) => `The whole ${n} timeline`,
    where: 'Save to', newCollection: 'New collection…', newName: 'Collection name', newPlaceholder: 'e.g. My Mars trip',
    defaultCollections: ['Favourites', 'Homework'], confirm: 'Save', cancel: 'Cancel',
    done: (c) => `Saved to “${c}”`, already: (c) => `Already in “${c}”`, view: 'View saved',
    empty: 'Nothing saved yet. Open a timeline and press Save.', open: 'Open', remove: 'Remove', removeAria: (t) => `Remove ${t}`,
    deleteCollection: 'Delete collection', moment: 'Moment', timeline: 'Timeline', count: (n) => `${n} saved`,
  },
  translate: {
    label: 'Language', aria: 'Translate this timeline box', english: 'English',
    note: 'Machine-translated from the English NASA text',
    loading: 'Translating…', failed: 'This translation could not be loaded, so the English text is shown.',
    partial: 'Some lines are not translated yet, so they are shown in English.',
  },
  zoomOut: 'Whole solar system',
  relatedPhoto: 'Related photo',
  fromPhotoSet: 'From this mission’s photo set',
  photoComingSoon: 'Photo coming soon',
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  next: 'Timeline',
  close: 'Close',
  flip: 'Flip card',
  backToCard: 'Back to card',
  play: 'Play story',
  pause: 'Pause',
  continueStory: 'Continue story',
  chat: {
    name: 'Astro',
    open: 'Ask Astro, your space guide',
    title: 'Ask Astro',
    subtitle: 'I only answer from our NASA mission files',
    placeholder: 'Ask a space question…',
    send: 'Send',
    minimize: 'Close chat (back to the astronaut)',
    closingSoon: 'Closing soon — tap or type to stay',
    thinking: 'Astro is looking through the mission files…',
    from: (name) => `From the ${name} file:`,
    sourceLabel: 'Source',
    show: (name) => `Show ${name}`,
    listIntro: (where) => `These are the machines in my files${where ? ` ${where}` : ''}:`,
    where: { moon: 'on the Moon', mars: 'on Mars', 'deep-space': 'in deep space' },
    hello: 'Hi, explorer! I’m Astro. Ask me anything about the NASA machines in Cosmic Tales — when they launched, where they landed, what they found and what happened to them.',
    help: 'I answer questions about the 8 NASA machines in our mission files: the Apollo 11, 12 and 15 lunar modules, Surveyor 3, Viking 1, Mars Pathfinder & Sojourner, NEAR Shoemaker and Kepler. Every answer is copied from those files, so I never make things up. Try one of these:',
    thanks: 'You’re welcome! Ask me anything else about our machines.',
    bye: 'Bye for now! Click me any time you have a space question.',
    refuse: 'Sorry, I can only answer questions about the 8 NASA machines in Cosmic Tales’ mission files. Try asking about one of them by name, for example:',
    notFound: (name) => `I couldn’t find that in the ${name} file. Try asking when it launched, where it landed, what it found, or what happened to it.`,
    error: 'Oops — I could not open my mission files. Check your connection and try again.',
  },
  moreInfo: {
    text: 'For more information, open this link.',
    button: (site) => `Open ${site}`,
    newTab: '(opens in a new tab)',
    missing: 'No “more information” link in our data for this machine yet.',
  },
  narration: {
    region: 'Narrator',
    listen: 'Listen',
    pause: 'Pause',
    continue: 'Continue',
    replay: 'Replay',
    loading: 'Loading…',
    speed: 'Speed',
    voice: 'Voice',
    unavailable: 'Voice not available for this moment',
    failed: 'Could not play the voice — check your connection',
    progress: 'Narration progress',
    hint: 'Press Listen to hear the story of this moment',
  },
  machinesHere: (n, body) => `${n} machine${n === 1 ? '' : 's'} on ${body}`,
  deepSpaceTitle: 'Roaming deep space',
  deepSpaceIntro: 'These explorers flew far beyond the Moon and Mars.',
  noPhoto: 'No photo of this moment in our data',
  noMachinePhoto: 'No photo of this machine in our data',
  photoFailed: 'Photo could not load — are you online?',
  approxPosition: 'Approximate spot — exact site not in our data',
  stylisedScale: 'Sizes and distances are squished so everything fits on screen.',
  hint: 'Drag to look around · scroll to zoom · click a glowing marker',
  webglError: 'Your browser could not start 3D graphics (WebGL). Try another browser or device.',
  dataError: 'The machine data could not be loaded. Run “npm run data” and reload.',
  card: {
    title: 'COSMIC CARD',
    subtitle: 'Interplanetary Machine Identity',
    name: 'Machine name',
    launchDate: 'Launch date',
    launchSite: 'Launch location',
    purpose: 'Purpose',
    abandoned: 'Year abandoned',
    status: 'Status',
    destination: 'Destination',
    vehicle: 'Rocket',
    kind: 'Type',
    aliases: 'Also known as',
    sources: 'Data sources',
    events: 'Key moments',
  },
  status: { ended: 'Mission ended', lost: 'Lost contact', retired: 'Retired', active: 'Active' },
  eventTypes: {
    launch: 'Launch',
    arrival: 'Arrival',
    landing: 'Landing',
    milestone: 'Milestone',
    discovery: 'Discovery',
    anomaly: 'Problem!',
    'lost-contact': 'Signal lost',
    end: 'Mission end',
  },
};

/** Credits shown on the back of the Cosmic Card for machines using a licensed model. */
export const MODEL_CREDITS = {
  mars_rover: '3D model: “High-Detail Mars Rover 3D Model” by shriyans716 (Sketchfab), CC-BY-4.0',
};

/** Rendering / performance knobs. */
export const RENDER = {
  maxPixelRatio: 2,
  bloom: { strength: 0.8, radius: 0.5, threshold: 0.9 },
  /** camera-mounted fill light (0 = off); keeps night sides readable from every angle */
  headlight: 0.7,
  /** soft fills: ambient + sky/ground hemisphere, so no planet ever has a pitch-black side */
  ambient: 0.26,
  hemi: 0.22,
  /** machine close-up: shadow-casting key light strength and slow camera orbit (OrbitControls units) */
  keyLight: 0.95,
  /** headlight strength during a close-up, as a fraction of normal */
  closeUpHeadlight: 0.45,
  closeUpOrbitSpeed: 0.35,
  /** faint edge glow on bodies without an atmosphere, so dark limbs stay visible */
  rimGlow: { color: '#a9b8ff', intensity: 0.4 },
  starCount: 9000,
  asteroidBeltCount: 2600,
  /** seconds a body must be unfocused before its 4K texture is released */
  hiResReleaseDelay: 25,
};
