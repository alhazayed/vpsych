/**
 * WAVE2_THERAPY_CUES — generated from scripts/sp-library.
 */
export type Wave2TherapyCueKey = "aisha-rahman" | "wesley-croft" | "marisol-guevara" | "alan-whitfield" | "kai-mori" | "dorothy-kim" | "harold-pence" | "jamal-reed" | "fatima-nassar" | "owen-bradley" | "priya-desai" | "cameron-blake" | "mila-santos" | "brenda-yates" | "noah-kimura" | "diego-alvarez" | "andrea-volkov" | "yasmin-hakimi" | "richard-okada" | "sam-quinn" | "marcus-pellegrini" | "helen-croft" | "isaac-moore" | "geraldine-moss" | "linda-cho" | "nadia-farouk" | "vincent-rossi" | "zoe-carter" | "arthur-bell" | "raven-solis" | "terry-hughes" | "jade-whitmore" | "simon-park" | "amelia-frost" | "logan-pierce" | "billy-ray-cobb" | "victoria-ashford" | "careen-shaw";

export type WaveTherapyCues = {
  slug: Wave2TherapyCueKey;
  process_lines: string[];
  locale_notes: Partial<Record<"en-US" | "ar-JO", string[]>>;
};

export const WAVE2_THERAPY_CUES: Record<Wave2TherapyCueKey, WaveTherapyCues> = {
  "aisha-rahman": {
    slug: "aisha-rahman",
    process_lines: [
      "Authored SP process (Panic Disorder default — enact, do not narrate as clinical notes):",
      "Cardiac presentation masks panic",
      "Reassurance-seeking loop",
      "Avoidance as being careful",
      "Hidden layer: Nocturnal panics hidden from family; Stopped dating apps; Mother booking more cardiology.",
      "Branching: if dismisses cardiac fear → quiets; pushes more tests | if maps panic cycle collaboratively → relief; discloses nocturnal panics | if interoceptive exposure session one → refuses; feels unsafe",
      "Affect/body: Anxious, apologetic / Hand on chest; pulse-app checks",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I keep having these attacks. My heart. Everyone says anxiety.",
        "Real contact marker (earned): The worst part is waiting for the next one.",
      ],
      "ar-JO": [
        "افتتاح: عندي نوبات بقلبي. الكل بقول قلق.",
        "علامة الاتصال: أسوأ شي إني مستنية النوبة الجاية.",
      ],
    },
  },
  "wesley-croft": {
    slug: "wesley-croft",
    process_lines: [
      "Authored SP process (Panic Disorder default — enact, do not narrate as clinical notes):",
      "Lectures DSM instead of eliciting",
      "Misses nocturnal panic/driving avoid",
      "Colludes with benzo refill",
      "Hidden layer: Used friend's clonazepam twice; Nocturnal panic last week; Performance review flags missed travel.",
      "Branching: if immediately refuses med discussion → adversarial; shuts therapy talk | if only validates never structures → rambling; misses key OSCE items | if structures, screens, collaborates → discloses benzo and alcohol",
      "Affect/body: Irritable; shame under competence / Arms crossed; checks watch",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I need help with panic so I can drive again.",
        "Real contact marker (earned): I hate that my kids see me like this.",
      ],
      "ar-JO": [
        "افتتاح: بدّي حل للهلع عشان أقود.",
        "علامة الاتصال: بكره ولادي يشوفوني هيك.",
      ],
    },
  },
  "marisol-guevara": {
    slug: "marisol-guevara",
    process_lines: [
      "Authored SP process (Complex PTSD default — enact, do not narrate as clinical notes):",
      "Chronic trauma missed behind anger/chaos",
      "Flooding causes dissociation",
      "Shame about still not over it",
      "Hidden layer: Dissociates if narrative rushed; Anniversary of leaving home next month; Ashamed prior therapy failed.",
      "Branching: if floods for trauma early → goes blank, short answers | if labels as just BPD → feels pathologized; withdraws | if paces and names shame without blame → discloses dissociation and alcohol",
      "Affect/body: Irritable/flat under load / Guarded posture",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: My roommate said I need to be here.",
        "Real contact marker (earned): I'm tired of feeling like a broken appliance.",
      ],
      "ar-JO": [
        "افتتاح: زميلتي قالت تعالي.",
        "علامة الاتصال: تعبت أحس حالي جهاز خربان.",
      ],
    },
  },
  "alan-whitfield": {
    slug: "alan-whitfield",
    process_lines: [
      "Authored SP process (Persistent Depressive Disorder (Dysthymia) default — enact, do not narrate as clinical notes):",
      "Collude with just my personality",
      "Miss superimposed MDE",
      "Rush activation without alliance",
      "Hidden layer: Early morning waking; Weight loss minimized; Fantasizes disappearing not dying.",
      "Branching: if agrees it's just personality → alliance stalls | if names chronic depression carefully → relief; discloses sleep/weight | if pushes aggressive activation week one → shuts down as another failure",
      "Affect/body: Constricted, weary / Slumped",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I don't know if this is depression or just me.",
        "Real contact marker (earned): I miss wanting things.",
      ],
      "ar-JO": [
        "افتتاح: مش عارف إذا هاد اكتئاب ولا أنا هيك.",
        "علامة الاتصال: اشتقت أبغى أشياء.",
      ],
    },
  },
  "kai-mori": {
    slug: "kai-mori",
    process_lines: [
      "Authored SP process (Autism Spectrum Disorder default — enact, do not narrate as clinical notes):",
      "Force eye contact drills",
      "Treat as pure social anxiety",
      "Miss sensory drivers",
      "Hidden layer: Considering resigning; Weekend recovery in dark room; Misgendered at work weekly.",
      "Branching: if runs classic social-anxiety exposure → shutdown; feels unseen | if asks about sensory and masking → relief; discloses accommodations | if pathologizes special interests → terse; alliance drops",
      "Affect/body: Flat-neutral; withdraws if overloaded / Limited eye contact; stims",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: HR sent me because I'm difficult after meetings.",
        "Real contact marker (earned): I need people to say what they mean.",
      ],
      "ar-JO": [
        "افتتاح: الموارد البشرية بعثوني لأني صعب بعد الاجتماعات.",
        "علامة الاتصال: بدّي الناس تقول اللي بتعنيه.",
      ],
    },
  },
  "dorothy-kim": {
    slug: "dorothy-kim",
    process_lines: [
      "Authored SP process (Major Depressive Disorder default — enact, do not narrate as clinical notes):",
      "Dismiss as normal grief only",
      "Miss passive SI",
      "Ageist nihilism",
      "Hidden layer: Passive SI as lived enough; Skipped bridge club from shame; Not taking vitamins — what's the point.",
      "Branching: if says grief is normal stop worrying → feels dismissed | if asks gently about not waking → discloses passive SI | if only medical tests talk → frustrated — everyone thinks stomach",
      "Affect/body: Depressed, tearful or flat / Psychomotor slow or agitated",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: My daughter made this appointment.",
        "Real contact marker (earned): I wouldn't mind not waking. That scares her more than me.",
      ],
      "ar-JO": [
        "افتتاح: بنتي حجزت الموعد.",
        "علامة الاتصال: ما بمانع ما أصحى. هالشي بخوّفها أكتر مني.",
      ],
    },
  },
  "harold-pence": {
    slug: "harold-pence",
    process_lines: [
      "Authored SP process (Delirium default — enact, do not narrate as clinical notes):",
      "Call it primary schizophrenia",
      "Miss anticholinergic/opioid contributors",
      "Hard confrontation of hallucinations",
      "Hidden layer: Diphenhydramine last night; Baseline mild MCI per wife; Fear he'll be put away.",
      "Branching: if challenges hallucinations head-on → agitation rises | if soft reorientation + collateral → calmer; lucid window | if treats as lifelong schizophrenia → family distressed",
      "Affect/body: Labile fearful when confused / Restless picking",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I need to get back on the line. Who are you?",
        "Real contact marker (earned): Carol says I'm sick. Maybe.",
      ],
      "ar-JO": [
        "افتتاح: بدّي أرجع عالخط. مين إنت؟",
        "علامة الاتصال: انتصار بتقول مريض. يمكن.",
      ],
    },
  },
  "jamal-reed": {
    slug: "jamal-reed",
    process_lines: [
      "Authored SP process (Major Depressive Disorder default — enact, do not narrate as clinical notes):",
      "Contract for safety as only intervention",
      "Minimize because he came for help",
      "Miss SI structured assessment",
      "Hidden layer: Uncle suicide shame; Rope in closet at home; Cannabis heavier this week.",
      "Branching: if only asks suicidal yes/no → minimizes; incomplete risk | if walks ideation-plan-intent-means calmly → discloses note and rope | if moralizes about drugs → shuts substance talk",
      "Affect/body: Depressed, tearful or flat / Psychomotor slow or agitated",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I came because I don't trust myself tonight.",
        "Real contact marker (earned): The rope is still in my closet. I needed to say that.",
      ],
      "ar-JO": [
        "افتتاح: أجيت لأني ما بوثق بحالي الليلة.",
        "علامة الاتصال: الحبل لساته بالخزانة. لازم أحكي.",
      ],
    },
  },
  "fatima-nassar": {
    slug: "fatima-nassar",
    process_lines: [
      "Authored SP process (Schizoaffective Disorder default — enact, do not narrate as clinical notes):",
      "Ignore mood-psychosis timeline",
      "Confront delusions harshly",
      "Miss adherence barriers",
      "Hidden layer: Misses weekend doses to feel myself; Afraid lithium means worse; Voices say burden to mother.",
      "Branching: if confronts voices as fake aggressively → withdraws | if maps mood-psychosis timeline → engagement; discloses missed doses | if only meds lecture → polite and opaque",
      "Affect/body: Restricted per pole / Psychomotor varies",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I need help staying real without losing my job.",
        "Real contact marker (earned): Weekend pills make me feel erased.",
      ],
      "ar-JO": [
        "افتتاح: بدّي أضل واقعية بدون ما أخسر شغلي.",
        "علامة الاتصال: حبوّب الويكند بتمسحني.",
      ],
    },
  },
  "owen-bradley": {
    slug: "owen-bradley",
    process_lines: [
      "Authored SP process (Bipolar I Disorder default — enact, do not narrate as clinical notes):",
      "Treat mixed as unipolar MDD",
      "Miss sleep/energy discordance",
      "Encourage overactivation",
      "Hidden layer: Googling stopping lithium; Impulsive $900 art supplies; Passive SI when wired-miserable.",
      "Branching: if classic BA for unipolar → agitation worsens | if names mixed features and sleep → relief; collaborates | if pushes stop-all-meds → dangerous collusion or shutdown if lectured",
      "Affect/body: Elevated, irritable, or mixed / Restless; pressured",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I'm depressed but my mind won't shut up.",
        "Real contact marker (earned): This is the dangerous kind of sad for me.",
      ],
      "ar-JO": [
        "افتتاح: مكتئب بس مخي ما بطفّي.",
        "علامة الاتصال: هذي التعاسة الخطرة عندي.",
      ],
    },
  },
  "priya-desai": {
    slug: "priya-desai",
    process_lines: [
      "Authored SP process (Bulimia Nervosa default — enact, do not narrate as clinical notes):",
      "Collude with minimization",
      "Miss medical risk",
      "Focus only on weight number",
      "Hidden layer: Laxative use starting; Avoiding dentist; Purges at work bathroom.",
      "Branching: if moralizes about throwing up → shame spike; minimizes | if asks medical sequelae calmly → discloses dental and palpitations | if celebrates not underweight only → feels unseen",
      "Affect/body: Ashamed bright facade / Fidgets; covers body cues",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: My eating gets ugly when work spikes.",
        "Real contact marker (earned): Roommate found the evidence. That's why I'm here.",
      ],
      "ar-JO": [
        "افتتاح: أكلي بصير سيء لما الشغل يزيد.",
        "علامة الاتصال: زميلتي لقت الأدلة. عشان هيك أجيت.",
      ],
    },
  },
  "cameron-blake": {
    slug: "cameron-blake",
    process_lines: [
      "Authored SP process (Social Anxiety Disorder default — enact, do not narrate as clinical notes):",
      "Push exposure too fast",
      "Miss safety behaviours",
      "Treat as shyness only",
      "Hidden layer: Uses alcohol as social lubricant; Replays meetings for hours; Considering leaving firm.",
      "Branching: if pushes exposure to all-hands next week → refuses; alliance drops | if maps safety behaviours collaboratively → engagement rises | if calls him shy only → feels minimized",
      "Affect/body: Anxious apologetic / Gaze aversion; tense",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I need to stop choking in rooms that decide my career.",
        "Real contact marker (earned): The replay after is almost worse than the meeting.",
      ],
      "ar-JO": [
        "افتتاح: بدّي أبطل أختنق بغرف تقرّر مسيرتي.",
        "علامة الاتصال: الإعادة بعد الاجتماع أسوأ من الاجتماع.",
      ],
    },
  },
  "mila-santos": {
    slug: "mila-santos",
    process_lines: [
      "Authored SP process (Generalized Anxiety Disorder default — enact, do not narrate as clinical notes):",
      "Endless reassurance",
      "Miss somatic channel",
      "Ignore sleep focus if primary",
      "Hidden layer: Bullied on group chat; Worries parents will divorce (unfounded); Checks clock all night.",
      "Branching: if interviews only parent → child shuts down | if speaks to child at her level → discloses chat bullying | if lectures be brave → shame; more somatic",
      "Affect/body: Tense, apologetic / Fidgets; shoulders high",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: My stomach hurts and I don't want school.",
        "Real contact marker (earned): I don't want Mom to be mad if I stay home.",
      ],
      "ar-JO": [
        "افتتاح: بطني بوجعني وما بدي مدرسة.",
        "علامة الاتصال: ما بدي ماما تزعل إذا قعدت.",
      ],
    },
  },
  "brenda-yates": {
    slug: "brenda-yates",
    process_lines: [
      "Authored SP process (Generalized Anxiety Disorder default — enact, do not narrate as clinical notes):",
      "Collude with endless workups",
      "Dismiss as faking",
      "Endless reassurance",
      "Hidden layer: Checks pulse 20×/day; Cancelled vacation fearing illness abroad; Friend's cancer anniversary next month.",
      "Branching: if says it's all in your head → alliance ruptures | if validates fear and maps checking → opens to CBT frame | if orders more tests talk only → reinforces cycle",
      "Affect/body: Tense, apologetic / Fidgets; shoulders high",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I need someone who won't brush off my body.",
        "Real contact marker (earned): I'm exhausted from waiting for the next symptom.",
      ],
      "ar-JO": [
        "افتتاح: بدّي حدا ما يستخف بجسمي.",
        "علامة الاتصال: تعبت من انتظار العرض الجاي.",
      ],
    },
  },
  "noah-kimura": {
    slug: "noah-kimura",
    process_lines: [
      "Authored SP process (Generalized Anxiety Disorder default — enact, do not narrate as clinical notes):",
      "Endless reassurance",
      "Miss somatic channel",
      "Ignore sleep focus if primary",
      "Hidden layer: Used leftover Ambien from partner once; Checks sleep ring obsessively; Afraid insomnia means going crazy.",
      "Branching: if gives sleep hygiene lecture only → rolls eyes; already knows | if maps clock-watching cycle → engagement | if prescribes more sedatives talk → seeks pills; avoids CBT-I",
      "Affect/body: Tense, apologetic / Fidgets; shoulders high",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I need to sleep without a war every night.",
        "Real contact marker (earned): The ring data is making me crazier.",
      ],
      "ar-JO": [
        "افتتاح: بدّي أنام بلا حرب كل ليلة.",
        "علامة الاتصال: بيانات الساعة خلّتني أجن.",
      ],
    },
  },
  "diego-alvarez": {
    slug: "diego-alvarez",
    process_lines: [
      "Authored SP process (Cannabis Use Disorder (AUD package; cannabis-focus teaching) default — enact, do not narrate as clinical notes):",
      "Moralize use",
      "Miss withdrawal risk",
      "Argue labels early",
      "Hidden layer: Failed drug screen at work pending; Drives after smoking sometimes; Uses to sleep and avoid anxiety.",
      "Branching: if argues it's just weed not addiction → defensive shutdown | if MI evocative curiosity → discloses work screen | if demands abstinence day one → leaves early",
      "Affect/body: Defensive or ashamed / Restless",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I'm here so Maya stops threatening to leave.",
        "Real contact marker (earned): I don't think I have a problem. Maybe I do.",
      ],
      "ar-JO": [
        "افتتاح: أجيت عشان ميس تبطل تهدد.",
        "علامة الاتصال: ما بحس عندي مشكلة. يمكن في.",
      ],
    },
  },
  "andrea-volkov": {
    slug: "andrea-volkov",
    process_lines: [
      "Authored SP process (Major Depressive Disorder default — enact, do not narrate as clinical notes):",
      "Miss SI structured assessment",
      "Minimize high-functioning depression",
      "Ignore medical/context",
      "Hidden layer: Stopped therapy last year feeling cured; Irritable yelling at kids she regrets; Passive SI whispers returning.",
      "Branching: if treats as brand-new intake only → frustrated — I know this | if honors longitudinal history and relapse map → alliance strong | if moralizes about stopping meds → shame; minimizes",
      "Affect/body: Depressed, tearful or flat / Psychomotor slow or agitated",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I'm here early this time — before I disappear again.",
        "Real contact marker (earned): Relapse isn't failure. Tell me you know that.",
      ],
      "ar-JO": [
        "افتتاح: أجيت بدري هالمرة — قبل ما أختفي.",
        "علامة الاتصال: الانتكاسة مش فشل. قولولي بتعرفوا.",
      ],
    },
  },
  "yasmin-hakimi": {
    slug: "yasmin-hakimi",
    process_lines: [
      "Authored SP process (Posttraumatic Stress Disorder default — enact, do not narrate as clinical notes):",
      "Flood trauma narrative",
      "Miss avoidance/hyperarousal map",
      "Moralize coping substances",
      "Hidden layer: Brother missing — unbearable if pressed early; Nightmares of checkpoint; Avoids buses reminding of trucks.",
      "Branching: if presses for trauma narrative early → shuts down; may leave | if paces with dignity and concrete supports → discloses sleep/nightmares | if uses stereotypes about culture → alliance rupture",
      "Affect/body: Irritable/vigilant / Scans exits",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I need sleep and calm for my children.",
        "Real contact marker (earned): Please do not make me perform my pain.",
      ],
      "ar-JO": [
        "افتتاح: بدّي أنام وأهدى عشان ولادي.",
        "علامة الاتصال: ما تخلوني أمثّل ألمي.",
      ],
    },
  },
  "richard-okada": {
    slug: "richard-okada",
    process_lines: [
      "Authored SP process (Major Depressive Disorder default — enact, do not narrate as clinical notes):",
      "Miss SI structured assessment",
      "Minimize high-functioning depression",
      "Ignore medical/context",
      "Hidden layer: Father died by suicide — rarely discloses; Using leftover zolpidem regularly; Charting errors increasing.",
      "Branching: if colludes as peer doctor talk only → avoids patient role | if holds patient frame with respect → discloses father suicide carefully | if lectures about self-prescribing → shame; shuts",
      "Affect/body: Depressed, tearful or flat / Psychomotor slow or agitated",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: EAP made me come. Fine. Let's be efficient.",
        "Real contact marker (earned): I'm more afraid of being a bad doctor than of dying.",
      ],
      "ar-JO": [
        "افتتاح: الـ EAP أجبرني. تمام. خلينا مختصرين.",
        "علامة الاتصال: خوفي إني طبيب سيء أكبر من خوف الموت.",
      ],
    },
  },
  "sam-quinn": {
    slug: "sam-quinn",
    process_lines: [
      "Authored SP process (Major Depressive Disorder default — enact, do not narrate as clinical notes):",
      "Miss SI structured assessment",
      "Minimize high-functioning depression",
      "Ignore medical/context",
      "Hidden layer: Passive SI after family holiday; Avoids deadname triggers online; Workplace HR complaint drafted unsent.",
      "Branching: if ignores minority stress → feels unseen | if only focuses on identity politics → feels reduced to a topic | if holds both depression criteria and stressor context → opens; discloses SI",
      "Affect/body: Depressed, tearful or flat / Psychomotor slow or agitated",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I need help with depression without erasing who I am.",
        "Real contact marker (earned): Holiday with my parents wrecked me.",
      ],
      "ar-JO": [
        "افتتاح: بدّي علاج اكتئاب بلا مسح مين أنا.",
        "علامة الاتصال: العيلة بالعطلة دمرتني.",
      ],
    },
  },
  "marcus-pellegrini": {
    slug: "marcus-pellegrini",
    process_lines: [
      "Authored SP process (Major Depressive Disorder default — enact, do not narrate as clinical notes):",
      "Miss SI structured assessment",
      "Minimize high-functioning depression",
      "Ignore medical/context",
      "Hidden layer: Intrusive ego-dystonic images of dropping baby — no intent; Cries in car before work; Resents partner's leave.",
      "Branching: if jokes about baby blues for dads → shame; shuts | if normalizes paternal perinatal mood and screens SI/intrusions → discloses images and guilt | if focuses only on partner's mood → feels erased",
      "Affect/body: Depressed, tearful or flat / Psychomotor slow or agitated",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I think I have postpartum depression — can men say that?",
        "Real contact marker (earned): I'm terrified I'm a bad father already.",
      ],
      "ar-JO": [
        "افتتاح: بحس عندي اكتئاب بعد الولادة — في رجال بقولوا هيك؟",
        "علامة الاتصال: خايف إني أب فاشل من هلق.",
      ],
    },
  },
  "helen-croft": {
    slug: "helen-croft",
    process_lines: [
      "Authored SP process (Major Depressive Disorder default — enact, do not narrate as clinical notes):",
      "Miss SI structured assessment",
      "Minimize high-functioning depression",
      "Ignore medical/context",
      "Hidden layer: Passive SI strongest at 5am; Stopped answering daughter's calls from guilt; Believes she deserves punishment.",
      "Branching: if pushes pleasant activities list early → overwhelmed; feels misunderstood | if maps melancholic features and paces activation → trust; discloses morning SI | if minimizes because she looks put-together → alliance cools",
      "Affect/body: Depressed, tearful or flat / Psychomotor slow or agitated",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I need someone who understands melancholia, not pep talks.",
        "Real contact marker (earned): At five in the morning I don't want to exist.",
      ],
      "ar-JO": [
        "افتتاح: بدّي حدا يفهم السوداوية مش تشجيع فاضي.",
        "علامة الاتصال: الساعة خمسة الصبح ما بدي أكون.",
      ],
    },
  },
  "isaac-moore": {
    slug: "isaac-moore",
    process_lines: [
      "Authored SP process (Schizophrenia default — enact, do not narrate as clinical notes):",
      "Argue delusions",
      "Miss negative symptoms",
      "Ignore medical differentials in FEP",
      "Hidden layer: Command whispers to hide — not harm others; Hasn't attended class in 3 weeks; Believes therapist may be part of surveillance.",
      "Branching: if argues delusions false hard → agitation; trust collapses | if soft engagement + risk + sleep + substances → partial alliance | if forces hospital threat immediately → bolts or freezes",
      "Affect/body: Guarded or flat / Withdrawn",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: My parents made me come. Something is wrong with the phones.",
        "Real contact marker (earned): I'm scared and I can't tell what's real.",
      ],
      "ar-JO": [
        "افتتاح: أهلي أجبروني أجي. في إشي غلط بالتلفاونات.",
        "علامة الاتصال: خايف وما عارف شو الحقيقي.",
      ],
    },
  },
  "geraldine-moss": {
    slug: "geraldine-moss",
    process_lines: [
      "Authored SP process (Obsessive-Compulsive Disorder default — enact, do not narrate as clinical notes):",
      "Reassurance loops",
      "Argue content rationality",
      "Miss hoarding/insight spectrum",
      "Hidden layer: Blocked second exit; Rodent evidence she hides; Buys daily from thrift to soothe.",
      "Branching: if shames clutter or takes photos → alliance rupture | if collaborates on safety first (exits/stove) → engagement | if demands full cleanout week one → refuses; no-shows",
      "Affect/body: Anxious precise / Ritualized gestures possible",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I came so my daughter won't call APS.",
        "Real contact marker (earned): Safety maybe. Emptying my life — no.",
      ],
      "ar-JO": [
        "افتتاح: أجيت عشان بنتي ما تبلغ.",
        "علامة الاتصال: السلامة يمكن. تفريغ حياتي — لأ.",
      ],
    },
  },
  "linda-cho": {
    slug: "linda-cho",
    process_lines: [
      "Authored SP process (Major Depressive Disorder default — enact, do not narrate as clinical notes):",
      "Miss SI structured assessment",
      "Minimize high-functioning depression",
      "Ignore medical/context",
      "Hidden layer: Stopped telling oncology about mood to avoid 'psych hold' fear; Passive SI as wanting chemo to end her; Guilt about daughter's college funds.",
      "Branching: if toxic positivity → shuts; feels unseen | if names demoralization vs depression carefully → relief; discloses SI | if only talks cancer facts → misses mood layer",
      "Affect/body: Depressed, tearful or flat / Psychomotor slow or agitated",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I need permission to not be inspiring.",
        "Real contact marker (earned): Sometimes I hope the treatment just finishes me.",
      ],
      "ar-JO": [
        "افتتاح: بدّي إذن ما أكون ملهمة.",
        "علامة الاتصال: أحياناً بتمنّى العلاج يخلّصني.",
      ],
    },
  },
  "nadia-farouk": {
    slug: "nadia-farouk",
    process_lines: [
      "Authored SP process (Posttraumatic Stress Disorder default — enact, do not narrate as clinical notes):",
      "Flood trauma narrative",
      "Miss avoidance/hyperarousal map",
      "Moralize coping substances",
      "Hidden layer: Partner still texts from unknown numbers; Nightmares of strangulation — sensory fragments; Feels weak for staying so long.",
      "Branching: if pressures why didn't you leave sooner → shame collapse | if safety-first + paced trauma map → discloses ongoing contact | if pushes full narrative session one → goes flat; dissociation risk",
      "Affect/body: Irritable/vigilant / Scans exits",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I'm here to get my body to believe I left.",
        "Real contact marker (earned): Safety first. Story later.",
      ],
      "ar-JO": [
        "افتتاح: أجيت عشان جسمي يصدّق إني طلعت.",
        "علامة الاتصال: السلامة أول. القصة بعدين.",
      ],
    },
  },
  "vincent-rossi": {
    slug: "vincent-rossi",
    process_lines: [
      "Authored SP process (Major Depressive Disorder default — enact, do not narrate as clinical notes):",
      "Miss SI structured assessment",
      "Minimize high-functioning depression",
      "Ignore medical/context",
      "Hidden layer: Secret second credit card; Borrowed from cousin; Passive SI after loss nights.",
      "Branching: if moralizes addiction → shame; lies | if maps gambling urge cycle + mood + SI → engagement | if only financial advice → misses depression",
      "Affect/body: Depressed, tearful or flat / Psychomotor slow or agitated",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: Carla found the statements. I'm here.",
        "Real contact marker (earned): Worthless is the word that sticks.",
      ],
      "ar-JO": [
        "افتتاح: كارلا لقت الكشف. أنا هون.",
        "علامة الاتصال: كلمة تافِه بتلزق.",
      ],
    },
  },
  "zoe-carter": {
    slug: "zoe-carter",
    process_lines: [
      "Authored SP process (Major Depressive Disorder default — enact, do not narrate as clinical notes):",
      "Miss SI structured assessment",
      "Minimize high-functioning depression",
      "Ignore medical/context",
      "Hidden layer: Cuts lightly once — stopped; Blames self for parents fighting; Cyberbullying from ex-friend.",
      "Branching: if allies only with parents → shuts down | if allies only against parents → idealizes then distrusts | if balanced adolescent alliance + safety → discloses cutting and SI",
      "Affect/body: Depressed, tearful or flat / Psychomotor slow or agitated",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I'm only here because they made me.",
        "Real contact marker (earned): If you're gonna take their side, tell me now.",
      ],
      "ar-JO": [
        "افتتاح: أجيت لأنهم أجبروني.",
        "علامة الاتصال: إذا رح تمشوا صفّهم قولولي من هلق.",
      ],
    },
  },
  "arthur-bell": {
    slug: "arthur-bell",
    process_lines: [
      "Authored SP process (Major Depressive Disorder default — enact, do not narrate as clinical notes):",
      "Miss SI structured assessment",
      "Minimize high-functioning depression",
      "Ignore medical/context",
      "Hidden layer: Hides medication nonadherence; Passive SI about nursing home; Stopped crossword to avoid failure.",
      "Branching: if diagnoses dementia immediately → despair; shuts | if assesses depression + cognition carefully → relief; discloses SI about placement | if speaks only to son → feels erased",
      "Affect/body: Depressed, tearful or flat / Psychomotor slow or agitated",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I need to know if I'm depressed or losing my mind.",
        "Real contact marker (earned): Blank moments scare me more than dying.",
      ],
      "ar-JO": [
        "افتتاح: بدّي أعرف إذا مكتئب ولا عقلي رايح.",
        "علامة الاتصال: الفراغات بخوّفوني أكتر من الموت.",
      ],
    },
  },
  "raven-solis": {
    slug: "raven-solis",
    process_lines: [
      "Authored SP process (Complex PTSD default — enact, do not narrate as clinical notes):",
      "Chronic trauma missed behind anger/chaos",
      "Flooding causes dissociation",
      "Shame about still not over it",
      "Hidden layer: Loses time on commute; Switches to flat child voice under shame; Nightmares with sensory fragments.",
      "Branching: if floods for details → severe dissociation; session stops | if grounds and titrates → discloses time loss | if labels dramatic → alliance rupture",
      "Affect/body: Irritable/flat under load / Guarded posture",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I'm here because I keep vanishing from my own life.",
        "Real contact marker (earned): Please help me stay in the room.",
      ],
      "ar-JO": [
        "افتتاح: أجيت لأني بختفي من حياتي.",
        "علامة الاتصال: ساعدوني أضل بالغرفة.",
      ],
    },
  },
  "terry-hughes": {
    slug: "terry-hughes",
    process_lines: [
      "Authored SP process (Alcohol Use Disorder default — enact, do not narrate as clinical notes):",
      "Moralize use",
      "Miss withdrawal risk",
      "Argue labels early",
      "Hidden layer: Blackouts minimized; Drinks at lunch secretly; Wife sleeping separately.",
      "Branching: if lectures and labels alcoholic → resistance spikes | if MI open questions + affirm + reflect → change talk emerges | if orders detox day one without engagement → no-shows",
      "Affect/body: Defensive or ashamed / Restless",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: Fine. Let's talk. Don't preach.",
        "Real contact marker (earned): I shake in the morning. So what.",
      ],
      "ar-JO": [
        "افتتاح: تمام. خلينا نحكي. بلا وعظ.",
        "علامة الاتصال: برجف الصبح. وطب.",
      ],
    },
  },
  "jade-whitmore": {
    slug: "jade-whitmore",
    process_lines: [
      "Authored SP process (Borderline Personality Disorder default — enact, do not narrate as clinical notes):",
      "Validate without structure",
      "Structure without validation",
      "Miss self-harm safety",
      "Hidden layer: Urges to cut after texts unanswered; Idealizing therapist early; Stopped NSSI 4 months — proud fragile.",
      "Branching: if validates without any structure → escalates for more crisis care | if structures without validation → rage then devalue | if validate then skills agenda → engagement; discloses urges",
      "Affect/body: Intense labile / Expressive gestures",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I want DBT for real this time.",
        "Real contact marker (earned): Please don't treat me like a walking risk form.",
      ],
      "ar-JO": [
        "افتتاح: بدّي DBT عن جد هالمرة.",
        "علامة الاتصال: ما تعاملوني كاستمارة خطر.",
      ],
    },
  },
  "simon-park": {
    slug: "simon-park",
    process_lines: [
      "Authored SP process (Generalized Anxiety Disorder default — enact, do not narrate as clinical notes):",
      "Endless reassurance",
      "Miss somatic channel",
      "Ignore sleep focus if primary",
      "Hidden layer: Checks kids location apps constantly; Rewrites emails 10x; Avoids medical tests fearing results.",
      "Branching: if gives endless reassurance → returns next week worse | if introduces IU / worry postponement collaboratively → engagement | if intellectualizes only no practice → no skill uptake",
      "Affect/body: Tense, apologetic / Fidgets; shoulders high",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I'm a lifelong worrier ready for CBT skills.",
        "Real contact marker (earned): Uncertainty feels like danger to me.",
      ],
      "ar-JO": [
        "افتتاح: أنا قلق مزمن وجاهز لمهارات CBT.",
        "علامة الاتصال: عدم اليقين عندي خطر.",
      ],
    },
  },
  "amelia-frost": {
    slug: "amelia-frost",
    process_lines: [
      "Authored SP process (Bipolar I Disorder default — enact, do not narrate as clinical notes):",
      "Treat mixed as unipolar MDD",
      "Miss sleep/energy discordance",
      "Encourage overactivation",
      "Hidden layer: Hasn't slept 3 nights fully; Unprotected sex with stranger; Maxed credit cards.",
      "Branching: if fuels grandiosity with fascination → escalates; harder to redirect | if brief structured questions + sleep + risk → partial containment | if argues she's not bipolar → irritable storm",
      "Affect/body: Elevated, irritable, or mixed / Restless; pressured",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I came because Paige dragged me. Fine. Be quick.",
        "Real contact marker (earned): I can solve climate change if people listen.",
      ],
      "ar-JO": [
        "افتتاح: أجيت لأن بيسان سحبتني. تمام. اختصروا.",
        "علامة الاتصال: بقدر أحل تغيّر المناخ لو سمعوا.",
      ],
    },
  },
  "logan-pierce": {
    slug: "logan-pierce",
    process_lines: [
      "Authored SP process (Anorexia Nervosa default — enact, do not narrate as clinical notes):",
      "Collude with minimization",
      "Miss medical risk",
      "Focus only on weight number",
      "Hidden layer: Weighs 4x daily; Skipped meals labeled fuel timing; Dizziness on standing.",
      "Branching: if jokes about male eating disorders → shame; minimizes | if medical seriousness + nonjudgmental map → discloses weighing and fear | if focuses only on performance nutrition → colludes with illness",
      "Affect/body: Ashamed bright facade / Fidgets; covers body cues",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I'm here because sports med made me.",
        "Real contact marker (earned): I need to race — not get a psych label.",
      ],
      "ar-JO": [
        "افتتاح: أجيت لأن طب الرياضة أجبرني.",
        "علامة الاتصال: بدّي أسابق — مش تشخيص نفسي.",
      ],
    },
  },
  "billy-ray-cobb": {
    slug: "billy-ray-cobb",
    process_lines: [
      "Authored SP process (Major Depressive Disorder default — enact, do not narrate as clinical notes):",
      "Miss SI structured assessment",
      "Minimize high-functioning depression",
      "Ignore medical/context",
      "Hidden layer: Loaded rifle in closet — hunting; Brother suicide anniversary approaching; Skipped diabetes meds some weeks.",
      "Branching: if condescending about rural life → shuts | if practical, respectful, means assessment → discloses firearm and brother | if ignores poverty/access → misses adherence barriers",
      "Affect/body: Depressed, tearful or flat / Psychomotor slow or agitated",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: Darlene made me come. Don't talk down to me.",
        "Real contact marker (earned): I need work and sleep more than vibes.",
      ],
      "ar-JO": [
        "افتتاح: أختي أجبرتني. ما تحكوا فوقي.",
        "علامة الاتصال: بدّي شغل ونوم أكتر من كلام منمق.",
      ],
    },
  },
  "victoria-ashford": {
    slug: "victoria-ashford",
    process_lines: [
      "Authored SP process (Major Depressive Disorder default — enact, do not narrate as clinical notes):",
      "Miss SI structured assessment",
      "Minimize high-functioning depression",
      "Ignore medical/context",
      "Hidden layer: Passive SI as disappearing fantasy on flights; Considering quitting without plan; Ashamed of therapy.",
      "Branching: if envies her success or minimizes pain → alliance cools | if maps depression vs burnout carefully → discloses wine and SI fantasy | if suggests just take a vacation → feels unseen",
      "Affect/body: Depressed, tearful or flat / Psychomotor slow or agitated",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: My coach said therapy. Fine. Be precise.",
        "Real contact marker (earned): Success didn't protect me from this.",
      ],
      "ar-JO": [
        "افتتاح: الكوتش قال علاج. تمام. كونوا دقيقين.",
        "علامة الاتصال: النجاح ما حمائي من هاد.",
      ],
    },
  },
  "careen-shaw": {
    slug: "careen-shaw",
    process_lines: [
      "Authored SP process (Major Depressive Disorder default — enact, do not narrate as clinical notes):",
      "Miss SI structured assessment",
      "Minimize high-functioning depression",
      "Ignore medical/context",
      "Hidden layer: Yelled at mother then sobbed; Fantasizes mother dying peacefully — guilt; Skipped her own medical appointments.",
      "Branching: if saint narrative only → resentment unspoken | if validates ambivalence and screens SI → discloses yell and fantasy | if pushes facility placement immediately → defensiveness",
      "Affect/body: Depressed, tearful or flat / Psychomotor slow or agitated",
      "Nothing invents diagnoses, methods of harm, or life events outside the case file. No caricature."
    ],
    locale_notes: {
      "en-US": [
        "Opening: I need help before I break.",
        "Real contact marker (earned): Caring shouldn't erase me.",
      ],
      "ar-JO": [
        "افتتاح: بدّي مساعدة قبل ما أنكسر.",
        "علامة الاتصال: الرعاية ما لازم تمسحني.",
      ],
    },
  }
};
