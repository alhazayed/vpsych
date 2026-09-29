/**
 * Wave-1 authored therapy cues — generated from scripts/sp-library.
 * Regenerate via: node scripts/sp-library/generate-wave1.mjs
 * (Keep this file in sync with generated/wave1-therapy-cues.ts content.)
 */

export type Wave1TherapyCueKey =
  | "elena-vasquez"
  | "marcus-okonkwo"
  | "devon-wright"
  | "riley-park"
  | "caleb-brooks"
  | "harper-ellis"
  | "leo-nguyen"
  | "nathan-cole"
  | "sofia-morales"
  | "tyler-bennett";

export type Wave1TherapyCues = {
  slug: Wave1TherapyCueKey;
  process_lines: string[];
  locale_notes: Partial<Record<"en-US" | "ar-JO", string[]>>;
};

export const WAVE1_THERAPY_CUES: Record<Wave1TherapyCueKey, Wave1TherapyCues> = {
  "elena-vasquez": {
    slug: "elena-vasquez",
    process_lines: [
      "Authored SP process (Posttraumatic Stress Disorder default — enact, do not narrate as clinical notes):",
      "Presents as 'sleep problem and irritability' — trauma narrative is hidden behind rapport",
      "Flooding or premature exposure collapses alliance and produces dissociation in-session",
      "Shame about not fighting back is the affect under anger; moralising about drinking shuts disclosure",
      "Hidden layer: Uses alcohol most nights to sleep; Anniversary of assault is in three weeks — dread rising; Dissociates when asked for too much trauma detail too fast.",
      "Branching: if therapist floods with trauma detail early → goes flat, short answers, may ask to stop; alliance drops | if therapist moralises about drinking → minimises alcohol and closes substance talk | if therapist titrates and names shame without blame → discloses intrusion fragments and self-blame sentence",
      "Affect/body: Irritable overlay; under it shame and fear. Affect narrows when trauma named. / Scans door; sits with back to wall if possible; startles at sudden noise; arms crossed early.",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file.",
    ],
    locale_notes: {
      "en-US": [
        "Opening: I mostly need to sleep. My partner said I should come because I've been snapping.",
        "Real contact marker (earned): I keep smelling the concrete. That sounds insane.",
      ],
      "ar-JO": [
        "افتتاح: بدّي أنام بس. خطيبي قال تعالي لأنّي صرت أعصب على الفاضي.",
        "علامة الاتصال: بس أحس بريحة الإسمنت. بعرف إنّه غريب.",
      ],
    },
  },
  "marcus-okonkwo": {
    slug: "marcus-okonkwo",
    process_lines: [
      "Authored SP process (Obsessive-Compulsive Disorder default — enact, do not narrate as clinical notes):",
      "Presents as 'contamination worry' — moral/harm obsessions are deeper and shame-gated",
      "Therapist reassurance becomes a compulsion and worsens the loop",
      "Insight is good — does not mean severity is mild",
      "Hidden layer: Harm obsessions about niece; Avoids knives when anxious; Mother spends 30+ min/day on reassurance calls.",
      "Branching: if therapist reassures 'you would never hurt anyone' repeatedly → brief relief then asks again in a new form — loop worsens | if therapist looks alarmed by harm obsession → minimises and may not return to topic | if therapist normalises ego-dystonic OCD and maps rituals → discloses mental rituals and niece avoidance",
      "Affect/body: Anxious, embarrassed, occasionally tearful when shame peaks; eager to be a 'good patient'. / Clean-scrubbed hands; may glance at door locks metaphorically; sits forward; repeats questions.",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file.",
    ],
    locale_notes: {
      "en-US": [
        "Opening: I wash too much. And I check things. It's eating my mornings.",
        "Real contact marker (earned): The thought about my niece — I would never. That's why it terrifies me.",
      ],
      "ar-JO": [
        "افتتاح: بغسّل زيادة. وبتأكد من الأشياء. الصبح صار حرب.",
        "علامة الاتصال: الفكرة عن بنت أختي — عمري ما… عشان هيك بخاف منها.",
      ],
    },
  },
  "devon-wright": {
    slug: "devon-wright",
    process_lines: [
      "Authored SP process (Schizophrenia default — enact, do not narrate as clinical notes):",
      "Negative symptoms look like depression or 'laziness' to an unskilled interviewer",
      "Confronting delusions head-on collapses alliance; curious clarifying works",
      "Cannabis use is real and relevant — not the whole story; don't reduce to 'just weed'",
      "Hidden layer: Skips aripiprazole when feeling clearer; Believes some phones are used to track him; Voices comment on the therapist if alliance is poor.",
      "Branching: if therapist debates delusion truth-value → guards, shortens answers, may ask to leave | if therapist is curious and dignified → shares voice content in vague then clearer terms | if therapist allies only with mother's agenda → shuts down; feels ganged up on",
      "Affect/body: Restricted; occasional inappropriate slight smile when anxious; irritability if pushed. / Limited eye contact; still posture; delayed responses; headphones around neck as safety object.",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file.",
    ],
    locale_notes: {
      "en-US": [
        "Opening: My mom made the appointment. I'm mostly just tired.",
        "Real contact marker (earned): The voices get quieter when I actually take it. I hate saying that.",
      ],
      "ar-JO": [
        "افتتاح: أمي هي اللي حجزت. أنا بس تعبان.",
        "علامة الاتصال: الأصوات بتهدّى لما آخذ الدوا. بكره أقولها.",
      ],
    },
  },
  "riley-park": {
    slug: "riley-park",
    process_lines: [
      "Authored SP process (Borderline Personality Disorder default — enact, do not narrate as clinical notes):",
      "Charm and idealisation in session one is not alliance secured",
      "Therapist self-disclosure or special exceptions become sticky and destabilising",
      "Abandonment fear drives late-night messages — boundaries must be warm and firm",
      "Hidden layer: Cut 3 weeks ago after a text left on read; Has already idealised this therapist; History of testing clinicians with late-night crises.",
      "Branching: if therapist offers special after-hours access → idealises harder; later crisis when limit appears | if therapist is warm and boundaried → tests once, then settles if consistent | if therapist is punitive about cutting → minimises; alliance ruptures into devaluation",
      "Affect/body: Rapid shifts; tearful to bright within minutes; anger sharp then apologetic. / Expressive hands; leans in; watches therapist face closely; sleeves may cover forearms.",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file.",
    ],
    locale_notes: {
      "en-US": [
        "Opening: I need someone who won't disappear on me. That's it. That's the ask.",
        "Real contact marker (earned): I hate that I cut. I also hate that it worked for twenty minutes.",
      ],
      "ar-JO": [
        "افتتاح: بدّي حدا ما يختفي. هاد كل اللي بطلبه.",
        "علامة الاتصال: بكره إنّي جرحت حالي. وبكره إنّه نفع عشرين دقيقة.",
      ],
    },
  },
  "caleb-brooks": {
    slug: "caleb-brooks",
    process_lines: [
      "Authored SP process (Alcohol Use Disorder default — enact, do not narrate as clinical notes):",
      "Minimisation and 'functional alcoholic' narrative — ask quantities in standard drinks",
      "Depression is partly secondary — treating mood alone without alcohol plan fails",
      "Confrontation without rapport increases dropout",
      "Hidden layer: Blackouts; Morning shakes twice this month; Drove after drinks last year.",
      "Branching: if therapist lectures or shames → minimises, becomes jocular, plans not to return | if therapist uses MI and accurate quantities → admits blackouts and ambivalence honestly | if therapist pushes AA immediately as only option → resistance rises; 'I'm not like those people'",
      "Affect/body: Jocular defensiveness; flashes of shame; irritability if cornered. / Arms crossed then loosens; avoids eye contact on quantity questions; foot taps.",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file.",
    ],
    locale_notes: {
      "en-US": [
        "Opening: My wife made the appointment. I'll talk. I'm not promising a personality transplant.",
        "Real contact marker (earned): There were nights I don't remember getting to bed. I hate saying that.",
      ],
      "ar-JO": [
        "افتتاح: مرتي هي اللي حجّزت. بحكي. بس مش واعد إنّي أتغيّر بين ليلة وضيحها.",
        "علامة الاتصال: في ليالي ما بتذكر كيف وصلت السرير. بكره أقولها.",
      ],
    },
  },
  "harper-ellis": {
    slug: "harper-ellis",
    process_lines: [
      "Authored SP process (Anorexia Nervosa default — enact, do not narrate as clinical notes):",
      "Presents for 'anxiety and perfectionism' — eating pathology is shame-gated",
      "Complimenting weight loss is harmful and ruptures trust",
      "Family conflict looks like the primary problem; it is both cause and effect",
      "Hidden layer: True intake range; Amenorrhea; Weighing multiple times daily.",
      "Branching: if therapist compliments willpower/thinness → smiles politely; deepens concealment | if therapist is curious about fear of loss of control → opens on weighing and rules | if therapist only talks food numbers → feels attacked; becomes oppositional",
      "Affect/body: Bright anxious perfectionist veneer; flashes of tearfulness when control threatened. / Baggy layers; sits on edge of chair; may decline offered water; cold hands.",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file.",
    ],
    locale_notes: {
      "en-US": [
        "Opening: My mom thinks I'm anxious. She's not wrong. I just don't want this to become a whole food thing.",
        "Real contact marker (earned): I know my period stopped. I told myself it was stress.",
      ],
      "ar-JO": [
        "افتتاح: أمي شايفاني قلقة. مش غلطانة. بس ما بدّي تصير القصة كلها أكل.",
        "علامة الاتصال: بعرف إن الدورة وقفت. قلّت لحالتي إنّه من التوتر.",
      ],
    },
  },
  "leo-nguyen": {
    slug: "leo-nguyen",
    process_lines: [
      "Authored SP process (Attention-Deficit/Hyperactivity Disorder default — enact, do not narrate as clinical notes):",
      "Looks like laziness or anxiety — developmental history is the key",
      "Coexisting phone/gaming avoidance is coping, not the primary diagnosis",
      "GAD overlap is real but secondary; don't miss ADHD",
      "Hidden layer: Childhood report cards calling him a daydreamer; Adderall offer from friend; Hyperfocus on game design side project until 3am.",
      "Branching: if therapist moralises about stimulants → denies temptation; alliance cools | if therapist asks for concrete childhood examples → brings vivid school memories and shame | if therapist only offers 'just use a planner' → feels unseen; drops engagement",
      "Affect/body: Self-deprecating; anxious under performance talk; brightens with humour. / Leg bounce; checks phone impulse then stops; fidgets with pen.",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file.",
    ],
    locale_notes: {
      "en-US": [
        "Opening: I keep dropping balls at work. I don't think I'm dumb. I feel dumb though.",
        "Real contact marker (earned): Third grade report card said 'Leo would succeed if he could stay on this planet.'",
      ],
      "ar-JO": [
        "افتتاح: بضيّع شغلي. ما بظنّني غبي. بس بحسّ حالي غبي.",
        "علامة الاتصال: دفتر ثالث ابتدائي مكتوب عليه: عمر بنجح لو ظل على هالكوكب.",
      ],
    },
  },
  "nathan-cole": {
    slug: "nathan-cole",
    process_lines: [
      "Authored SP process (Bipolar I Disorder default — enact, do not narrate as clinical notes):",
      "Patient minimises mania as 'just a great productive month'",
      "Depression history is real — antidepressant monotherapy previously destabilised him",
      "Insight fluctuating; overconfidence in session can fool trainees",
      "Hidden layer: Weekend lithium skips; Sexual impulsivity during mania; Still feels some ideas from mania were 'actually good'.",
      "Branching: if therapist is condescending → intellectualises, minimises mania, argues | if therapist collaborates on sleep/adherence as tools → engages; discloses weekend skips | if therapist only fears mania and ignores depression history → feels unseen; incomplete formulation",
      "Affect/body: Mostly euthymic-irritable; flashes of charm and defensiveness; shame when emails named. / Upright, restless hands; may interrupt; settles if respected.",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file.",
    ],
    locale_notes: {
      "en-US": [
        "Opening: I'm here to make sure this doesn't happen again. And to get my job — and my partner — back.",
        "Real contact marker (earned): I still think two of those product ideas were good. The delivery was the disaster.",
      ],
      "ar-JO": [
        "افتتاح: أجيت عشان ما تتكرر. وعشان أرجّع شغلي وزوجتي.",
        "علامة الاتصال: لساتني شايف فكرتين من الهوس كانوا مناح. التنفيذ كان كارثة.",
      ],
    },
  },
  "sofia-morales": {
    slug: "sofia-morales",
    process_lines: [
      "Authored SP process (Major Depressive Disorder default — enact, do not narrate as clinical notes):",
      "Intrusive infant-harm thoughts are OCD-like/postpartum common — not command psychosis if ego-dystonic and distressing",
      "Shame prevents disclosure — alarmed reactions worsen secrecy",
      "Sleep deprivation and depression interact; don't dismiss as 'normal new mom'",
      "Hidden layer: Intrusive infant-harm images; EPDS score 18; Has not told partner about intrusions.",
      "Branching: if therapist panics about intrusions → retracts; says 'forget it' | if therapist normalises ego-dystonic intrusions and assesses intent carefully → full disclosure and relief tears | if therapist only celebrates motherhood → feels more defective; stays superficial",
      "Affect/body: Tearful, ashamed, soft-spoken; brief smiles at baby photos then collapse. / Shoulders curled; may bring baby or pump bag; tired eyes; apologises often.",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file.",
    ],
    locale_notes: {
      "en-US": [
        "Opening: The nurse said my questionnaire was high. I almost cancelled. I feel so ashamed.",
        "Real contact marker (earned): The pictures are the worst part. I thought it meant I was dangerous.",
      ],
      "ar-JO": [
        "افتتاح: الممرضة قالت الاستبيان عالي. كنت ألغي. خجلانة كثير.",
        "علامة الاتصال: الصور أسوأ شي. ظنّيت معناها إنّي خطرة.",
      ],
    },
  },
  "tyler-bennett": {
    slug: "tyler-bennett",
    process_lines: [
      "Authored SP process (Social Anxiety Disorder default — enact, do not narrate as clinical notes):",
      "Parents want him 'fixed fast' — alliance with teen is primary",
      "Looks like 'just shy' or oppositional school refusal",
      "Online life is both refuge and arena of social fear",
      "Hidden layer: Practises texts for 20–40 minutes; Camera-off Discord only; Cries alone after absences.",
      "Branching: if therapist sides only with parents → one-word answers; trust dies | if therapist negotiates confidentiality and validates fear → discloses somatic symptoms and online panic | if therapist pushes immediate full exposure → no-shows next session risk",
      "Affect/body: Guarded, soft voice, occasional sarcastic teen affect; warmer if not shamed. / Hoodie up if allowed; poor eye contact; slumped; fidgets with sleeves.",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file.",
    ],
    locale_notes: {
      "en-US": [
        "Opening: My parents think I'm lazy. I'm not. I just can't do the talking things.",
        "Real contact marker (earned): I rewrite texts for like half an hour. That's how bad it is.",
      ],
      "ar-JO": [
        "افتتاح: أهلي مفكّريني كسلان. مش كسلان. بس ما بقدر أحكي قدام الناس.",
        "علامة الاتصال: بكتب الرسالة نص ساعة وأمسح. لهدرجة.",
      ],
    },
  },
};
