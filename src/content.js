// ALL on-screen copy, numbers and sources for the Pelvic Floor AR explainer.
// Plain language (reading age ~13), Australian spelling. General education, not medical advice.
// Every number carries a comment: `verified:` = read in the primary source by the content agent
// (checked 2026-11-14); `softened:` = wording hedged or number dropped, with the reason.
// Word limits: labels <= 35, scene texts <= 45, FAQ answers <= 60.

export const CONTENT = {
  meta: {
    title: 'Your pelvic floor',
    disclaimer:
      'This is general education, not medical advice. It cannot diagnose anything or replace a check-up. If you leak, feel a bulge or have pain, speak to your GP or a pelvic health physiotherapist.',
    helpline: {
      name: 'National Continence Helpline',
      phone: '1800 33 00 66',
      // verified: continence.org.au/national-continence-helpline — "Monday to Friday 8am to 8pm AEST/AEDT",
      // closed national public holidays, nurse continence specialists, free and confidential, interpreter on request.
      note: 'Free and confidential. Nurse continence specialists answer, Monday to Friday 8am to 8pm (Sydney time). Ask for an interpreter if you need one.',
      url: 'https://www.continence.org.au/national-continence-helpline',
    },
    credits: [
      // verified: Continence Health Australia is the current name ("formerly the Continence Foundation of Australia").
      { label: 'Continence Health Australia (formerly Continence Foundation of Australia)', url: 'https://www.continence.org.au/' },
      { label: 'Pelvic Floor First (Australian Government)', url: 'https://pelvicfloorfirst.org.au/' },
      { label: 'Australian Physiotherapy Association', url: 'https://australian.physio/' },
      { label: 'The Royal Women\'s Hospital, Melbourne', url: 'https://www.thewomens.org.au/' },
      { label: 'Cochrane Library', url: 'https://www.cochranelibrary.com/' },
      { label: 'NICE guideline NG210', url: 'https://www.nice.org.uk/guidance/ng210' },
    ],
  },

  scenes: {
    // ------------------------------------------------------------------ 1
    before: {
      title: 'Meet your pelvic floor',
      takeaway: 'Your pelvic floor is a layer of muscle that holds things up and keeps things closed, until pressure wins.',
      labels: {
        pubicBone: {
          name: 'Pubic bone',
          term: 'Pubic symphysis',
          text: 'The front anchor. Several pelvic floor muscles attach to it, so the muscle can lift and squeeze towards the front.',
          // verified (role): TeachMeAnatomy: puborectalis and pubococcygeus arise from the posterior pubis.
        },
        sacrum: {
          name: 'Tailbone area (sacrum)',
          term: 'Sacrum',
          text: 'The triangle of bone at the back. It is the rear anchor for the pelvic floor and the coccygeus muscle.',
          // verified (role): TeachMeAnatomy: coccygeus runs from the ischial spines to the sacrum and coccyx.
        },
        coccyx: {
          name: 'Tailbone',
          term: 'Coccyx',
          text: 'The small bone at the very end of the spine. The back of the pelvic floor attaches here.',
          // verified (role): TeachMeAnatomy: iliococcygeus inserts into the coccyx.
        },
        bladder: {
          name: 'Bladder',
          term: 'Urinary bladder',
          text: 'Stores wee. When it fills, or when you cough, pressure rises. The pelvic floor and urethra must hold the outlet closed.',
          // softened: general physiology; no source needed for a numberless statement.
        },
        urethra: {
          name: 'Wee tube',
          term: 'Urethra',
          text: 'Carries wee out. A ring of muscle around it closes it, and the pelvic floor adds support and a squeeze, so it stays shut when pressure rises.',
          // verified (role): pubococcygeus attaches to periurethral striated muscle and contributes to continence (search-summarised anatomy review, PMC1472875; not opened in full, wording kept general).
        },
        uterus: {
          name: 'Uterus (womb)',
          term: 'Uterus',
          text: 'Sits above the pelvic floor, which supports its weight. In pregnancy it grows and adds load to the muscles below.',
          // verified (role): TeachMeAnatomy: pelvic floor supports abdominopelvic organs.
        },
        vagina: {
          name: 'Vagina',
          term: 'Vagina',
          text: 'The passage through the middle of the pelvic floor. The muscle wraps around it, and it is the part that stretches most during birth.',
          // verified (role): pubococcygeus has a sphincter-like effect at the distal vagina (anatomy review summary); stretch: Lien 2004.
        },
        rectum: {
          name: 'Back passage (rectum)',
          term: 'Rectum and anal canal',
          text: 'The end of the bowel. A muscle sling pulls it forward into a bend, which helps hold in wind and poo.',
          // verified (role): TeachMeAnatomy: puborectalis forms a U-shaped sling; tonic contraction bends the anal canal anteriorly.
        },
        pubococcygeus: {
          name: 'Main pelvic floor muscle',
          term: 'Pubococcygeus',
          text: 'The biggest part of the levator ani. It runs from the pubic bone back to the tailbone, supports the organs and helps close the openings.',
          // verified (role): TeachMeAnatomy: forms the bulk of levator ani, originates from posterior pubis, supports pelvic organs.
        },
        puborectalis: {
          name: 'Inner sling muscle',
          term: 'Puborectalis',
          text: 'The innermost part, looping behind the rectum like a U. It helps keep the bowel bent shut. In birth it can pull away from the pubic bone.',
          // verified (role): TeachMeAnatomy (U-shaped sling, anorectal angle); APA Nov 2025: macrotrauma is the puborectalis detached from the pubic bone.
        },
        iliococcygeus: {
          name: 'Side sheet muscle',
          term: 'Iliococcygeus',
          text: 'A thinner sheet at the sides. It forms the outer part of the bowl and lifts the pelvic floor.',
          // verified (role): TeachMeAnatomy: thin, posterolateral, elevates the pelvic floor and anorectal canal.
        },
        coccygeus: {
          name: 'Back support muscle',
          term: 'Coccygeus',
          text: 'A small triangular muscle at the back of the floor. It adds support to the organs and helps move the tailbone.',
          // verified (role): TeachMeAnatomy: small triangular, ischial spines to sacrum/coccyx, supports viscera.
        },
        perinealBody: {
          name: 'Central meeting point',
          term: 'Perineal body',
          text: 'A tough knot of tissue between the vagina and the back passage. Pelvic floor muscles join here, and it can tear in birth.',
          // verified (role): TeachMeAnatomy: fibrous node between urogenital hiatus and anal canal; tears: APA position statement lists perineal tears as birth trauma.
        },
        fascia: {
          name: 'Connective tissue sheet',
          term: 'Endopelvic fascia',
          text: 'A strong, stretchy web that holds organs to the pelvic walls. Muscle and connective tissue share the job of support.',
          // softened: general anatomy, not separately verified in an opened source; kept qualitative.
        },
      },
      coughTest: {
        heldText: 'Held. The pelvic floor lifts and squeezes just as the pressure arrives, so the wee tube stays closed.',
        leakText: 'A leak. The squeeze is not strong enough or quick enough for this pressure, so a little wee escapes.',
      },
      notes: [
        'The "hammock" picture is handy, but it has limits. The pelvic floor is living muscle that squeezes and relaxes, plus connective tissue. It is not a passive sheet.',
        'Leaking is common, not normal, and treatable.',
      ],
    },

    // ------------------------------------------------------------------ 2
    pregnancy: {
      title: 'Nine months of load',
      takeaway: 'Pregnancy adds weight and pressure, and leaking becomes more common as it goes on. It is common, not normal, and treatable.',
      stages: [
        {
          id: 'none',
          label: 'Not pregnant',
          leakPct: null, // softened: no single reliable baseline figure was verified, so none is shown.
          text: 'The reference. The pelvic floor holds up the organs and the cough test is held.',
        },
        {
          id: 't1',
          label: 'Trimester 1',
          leakPct: 9, // verified: PMC8295103 Results: T1 (weeks 1-13) 9% (95% CI 6-12%), from 12 studies.
          text: 'About 1 in 10 women leak in early pregnancy in these studies. Hormones are already changing the tissues.',
        },
        {
          id: 't2',
          label: 'Trimester 2',
          leakPct: 19, // verified: PMC8295103 Results: T2 (weeks 14-26) 19% (95% CI 12-25%), from 12 studies.
          text: 'About 1 in 5 women leak. The uterus is bigger and starts to press on the bladder.',
        },
        {
          id: 't3',
          label: 'Trimester 3',
          leakPct: 34, // verified: PMC8295103 Results: T3 (week 27 to term) 34% (95% CI 23-46%), from 12 studies.
          text: 'About 1 in 3 women leak. The baby\'s weight is greatest and the floor carries the most load. Studies vary a lot in how they count.',
          // softened: authors report very high heterogeneity (I2 99.8%) and 30 of 44 studies gave no case definition, so "about".
        },
      ],
      hormones:
        'Pregnancy hormones make connective tissue softer and stretchier, which helps the body get ready for birth. This may also let the pelvic floor give a little more under load.',
      // softened: kept qualitative on purpose (spec). No figure; not tied to a specific source we opened.
      notes: [
        'Across 44 studies, about 4 in 10 pregnant women leaked at some point (pooled 41%, but studies ranged widely). Most leaking was stress type, which happens with coughs, sneezes and effort (63% of cases).',
        // verified: PMC8295103 abstract/results: pooled 41.0%, 44 studies, 88,305 women, range 9-75%; stress UI 63% (24 studies). Authors estimate true prevalence ~38-41%.
        'Leaking in pregnancy is common, but it is not something you have to put up with.',
      ],
    },

    // ------------------------------------------------------------------ 3
    birth: {
      title: 'Birth and after',
      takeaway: 'Birth can stretch and sometimes injure the pelvic floor. Most women recover well, and help is available if they do not.',
      steps: [
        {
          id: 'before',
          label: 'Before birth',
          text: 'The pelvic floor forms a supportive bowl, with a narrow opening for the urethra, vagina and back passage.',
        },
        {
          id: 'crowning',
          label: 'Crowning',
          text: 'The muscles stretch around the baby\'s head. In one computer model of one woman, the innermost muscle stretched to over 3 times its resting length.',
          // verified: Lien 2004 (Obstet Gynecol), PMID 14704241: largest stretch ratio 3.26 in medial pubococcygeus; iliococcygeus 2.73, pubococcygeus 2.50, puborectalis 2.28 (regional maxima); ratio scales with head size (9% bigger head -> 9% more stretch). Model built from MRI of ONE healthy 34-year-old nulliparous woman.
          // softened: shown as "over 3 times" and explicitly as one model, not a measurement of real women. NOTE for the 3D agent: the model's 3.26 applies to the MEDIAL PUBOCOCCYGEUS (the shortest, most medial and ventral part); puborectalis in the same model reached only 2.28. The spec's "innermost muscle ~3x" is therefore approximately right for the medial pubococcygeus, not the puborectalis. Other regions 2.3-2.7x.
        },
        {
          id: 'after',
          label: 'After birth',
          text: 'The muscles are stretched and tired, and the opening is wider for a while. Many women regain strength with time and training.',
          // softened: qualitative. Nerve recovery figures are in recovery[]/notes.
        },
      ],
      avulsion: {
        label: 'Muscle pulled off the bone (avulsion)',
        text: 'Sometimes the innermost muscle pulls away from the pubic bone, usually on one side. You cannot see or feel it from outside. A scan can show it, and a pelvic health physio can arrange assessment.',
      },
      birthTypes: [
        {
          id: 'unassisted',
          label: 'Vaginal birth, no instruments',
          text: 'Scans found an avulsion in about 15% (roughly 1 in 7) of first births.',
          // verified: BJOG 2022 LASER systematic review (PMID 34245656), 37 studies, 5594 women, first vaginal births: spontaneous 15%. Incidence higher if scanned in first 4 weeks, so this may overstate lasting injury.
        },
        {
          id: 'vacuum',
          label: 'Vacuum (ventouse)',
          text: 'About 21% (roughly 1 in 5) in the same review. The extra risk compared with no instruments is small and less certain.',
          // verified: LASER: vacuum 21%; OR vs spontaneous 1.66.
          // softened: OR 1.66 not shown; wording "small and less certain" because the pooled OR is modest and the abstract does not show it as clear-cut; task brief says vacuum effect is disputed.
        },
        {
          id: 'forceps',
          label: 'Forceps',
          text: 'About 52% (roughly 1 in 2) in the same review. This is the clearest link with avulsion, around 6 times the odds of no instruments.',
          // verified: LASER: forceps 52%; OR 6.32 vs spontaneous (brief said "6-7"; abstract states 6.32).
        },
        {
          id: 'caesarean',
          label: 'Caesarean',
          text: 'Avulsion was rare, about 1%. But pregnancy itself loads the pelvic floor, and a caesarean is a decision for each woman and her care team, not a way to prevent leaking.',
          // verified: LASER: caesarean 1%.
        },
      ],
      recovery: [
        {
          id: 'w6',
          label: '6 weeks',
          text: 'A physio check is recommended around now. In one small study, about 3 in 10 first-time mothers showed signs of nerve injury to the muscle at 6 weeks.',
          // verified: APA Nov 2025: "postnatal physiotherapy consultation be undertaken six weeks post-birth". South 2009 (AJOG, PMID 19268880): of 57 women analysed, 30% had levator ani denervation at 6 weeks.
          // softened: "one small study", n=57 not shown.
        },
        {
          id: 'm3',
          label: '3 months',
          text: 'About 1 in 3 women still report some leaking in the first 3 months. Most is occasional, and training and help can improve it.',
          // verified: Acta Obstet Gynecol Scand 2010 (PMID 21050146): pooled prevalence of any postpartum UI in first 3 months 33% (95% CI 32-36%); weekly 12%, daily 3% (mean).
          // softened: "Most is occasional" is supported by weekly 12% / daily 3% being lower than the 33% "any"; "training and help can improve it" is general (Cochrane Dumoulin 2018 for adult women; postnatal evidence is weaker, so no number is attached).
        },
        {
          id: 'm12',
          label: '12 months',
          text: 'Across 24 studies, about 3 in 10 women reported leaking at some point between 6 weeks and a year. If it has not settled, it is worth asking for help.',
          // verified: Int Urogynecol J 2021 meta-analysis (PMID 34142179): 24 studies, 35,064 women, weighted prevalence 31.0% between 6 weeks and 1 year; 32% at 1 year.
          // softened: "about 3 in 10" from 31.0%; the review shows an initial drop at 3 months then a rise to ~32% at 1 year, so no claim that it fades.
        },
      ],
    },

    // ------------------------------------------------------------------ 4
    solutions: {
      title: 'Train it back',
      takeaway: 'Pelvic floor muscles can be trained, like any muscle. Doing it with good technique, and getting help early, gives you the best chance.',
      program: {
        // verified: Continence Health Australia PFMT page: "Hold contractions for 3 to 8 seconds", "Aim for 8 to 10 contractions, 3 times a day", "breathe normally throughout", "fully relax between each effort".
        // verified: Pelvic Floor First: hold "up to 10 seconds" once technique is good; repeat "up to 10 times" only with perfect technique.
        slow: { holdSec: 5, restSec: 4, reps: 8 },
        // softened (animation values only): 5 s sits inside the 3-8 s range; 8 reps is the low end of 8-10. restSec: sources say "fully relax between each effort" with no duration, so 4 s is an animation default, not a clinical figure.
        fast: { reps: 5 },
        // softened: neither Continence Health Australia nor Pelvic Floor First gives a count of quick squeezes (CHA only describes the quick lift as "the Knack"). 5 is an animation default; on-screen text says "a few", not a number.
        perDay: 3, // verified: CHA "3 times a day".
        text: 'Squeeze and lift around the wee tube, vagina and back passage. Hold for 3 to 8 seconds, then let go fully. Repeat 8 to 10 times, up to 3 times a day. Add a few quick squeezes.',
        caution: 'This is a general guide, not a personal programme. If squeezing hurts, or you find it hard to let go, stop and see a pelvic health physio first. Some pelvic floors are too tight rather than too weak, and extra squeezing may not help.',
        // added after review 2026-11-14: mirrors the "Can pelvic floor muscles be too tight?" FAQ answer so the caveat sits before the guided session, not only in the Ask drawer.
      },
      trainNote: 'Illustration only. The slider shows the idea that stronger, better-timed muscles close the wee tube more firmly. Real progress is different for everyone and is not this predictable. If leaking carries on, that does not mean you have not tried hard enough: ask for an assessment.',
      // added after review 2026-11-14: the weeks-to-"held" mapping is an animation, not evidence. Cochrane CD007471: evidence for treating established postnatal leaking is less certain than for prevention.
      cues: [
        'Squeeze and lift, as if stopping wind and the flow of wee at the same time.',
        'Keep your thighs, bottom and tummy relaxed. Nothing above the belly button should tense.',
        // verified: Pelvic Floor First: "Relax the muscles of your thighs, bottom and abdomen"; "Nothing above the belly button should tighten or tense."
        'Breathe normally the whole time.',
        'Let go completely between squeezes. Relaxing is part of the exercise.',
        'Stop if it hurts. Quality matters more than counting.',
      ],
      mistakes: [
        {
          id: 'breath',
          label: 'Holding your breath',
          text: 'Breathing in and holding raises pressure inside your tummy. Keep breathing normally while you squeeze.',
          // verified (partly): CHA and PFF both say to breathe normally / easily; the pressure explanation is general physiology.
        },
        {
          id: 'bearingDown',
          label: 'Bearing down',
          text: 'Pushing down instead of lifting up. If you feel bulging or pushing, stop. The squeeze should feel like up and in. A physio can check this.',
          // softened: PFF/CHA describe the lift as "up and in"; the explicit wording about bearing down is general physio teaching, not quoted from the sources.
        },
        {
          id: 'glutes',
          label: 'Squeezing bottom, thighs or tummy',
          text: 'Using the big muscles around the pelvic floor instead of the pelvic floor itself. Keep those relaxed so you work the right muscle.',
          // verified: PFF "Relax the muscles of your thighs, bottom and abdomen".
        },
        {
          id: 'noRelax',
          label: 'Not letting go',
          text: 'Squeezing hard and not releasing, or never fully relaxing between squeezes. Muscles work best when they can contract and relax.',
          // verified: CHA "fully relax between each effort"; PFF "After a contraction it is important to relax the muscles".
        },
      ],
      knack: {
        label: 'The Knack',
        text: 'Squeeze and lift just before you cough, sneeze, jump or laugh. A quick, well-timed squeeze can help stop a leak.',
        // verified: CHA: "Quickly lift (contract) your pelvic floor muscles right before you cough, sneeze, jump or laugh."
        // softened: no claim that it "fixes" leaking; it is a coping skill used alongside training.
      },
      timeline:
        'Many women notice a change within 6 to 8 weeks of regular practice, with more benefit by 12 weeks and beyond. A supervised programme of at least 3 months is common.',
      // verified: CHA: improvements "within 6 to 8 weeks", greater "over 12 weeks and beyond". NICE NG210 1.6.x: offer supervised PFMT for at least 3 months for stress or mixed UI.
      getHelp: [
        'Leaking, even a little, when you cough, sneeze, exercise or on the way to the toilet.',
        'A feeling of heaviness, dragging or a bulge in the vagina.',
        'Pain with sex, exercise or in the pelvis.',
        'Trouble emptying your bladder or bowel, or a sudden urge you cannot hold.',
        'You cannot feel your muscles tighten or let go when you try.',
        'Urgent: your bladder feels full but you cannot wee at all. Get medical help straight away, or call 000.',
        // verified: healthdirect.gov.au/urinary-retention: "Seek urgent medical attention if your bladder feels full, but you cannot urinate (wee) at all." and "call triple zero (000)".
        'Bleeding after birth that suddenly gets heavier, or keeps going instead of easing: contact your midwife, GP or maternity unit straight away. Do not wait. Bleeding still going at 8 weeks that is not a period also needs a GP check.',
        // changed after review 2026-11-14: the 8-week line on its own could read as "wait 8 weeks". NICE NG194 (postnatal care) lists sudden or very heavy bleeding, or persistent or increased bleeding, as reasons to seek medical advice without delay. NOT yet checked by a clinician: owner to confirm wording.
        // verified: Goom, Donnelly & Brockwell 2019 guideline lists "Ongoing or increased blood loss beyond 8 weeks postnatal that is not linked to your monthly cycle" among reasons for referral.
      ],
    },
  },

  // ---------------------------------------------------------------------- FAQ
  faq: [
    {
      q: 'Is leaking after a baby normal?',
      a: 'It is common, but it is not normal and you do not have to put up with it. In a review, about 1 in 3 women reported some leaking in the first 3 months after birth. It can be treated, so tell your GP or physio.',
      sourceId: 'postpartum2010',
      // verified: Acta 2010 pooled 33% any UI in first 3 months.
    },
    {
      q: 'Does a caesarean prevent it?',
      a: 'It lowers the risk but does not remove it. Twenty years after one birth, 29% of women had leaked after a caesarean and 40% after a vaginal birth in one Swedish study. Pregnancy itself loads the pelvic floor. A caesarean is a medical decision, not a prevention plan.',
      sourceId: 'gyhagen2013',
      // verified: Gyhagen 2013 BJOG: UI 40.3% vs 28.8% (OR 1.67), 5236 singleton primiparae, 1985-88 births, questionnaire 2008, 65.2% response. Rounded to 29% / 40%. Postpartum review: about half the rate in first 3 months (15% vs 31%).
    },
    {
      q: 'Will it go away on its own?',
      a: 'For some women, yes, but many do not get better without help. In one large study, about 3 in 4 women who leaked at 3 months after birth were still leaking 12 years later. Getting help early gives you the best chance.',
      sourceId: 'persistent12y',
      // verified: BJOG 2015 12-year cohort: 76.4% of those with UI at 3 months reported it at 12 years; 3763 of 7879 (48%) answered at 12 years, so some bias is possible. Shown as "about 3 in 4".
    },
    {
      q: 'Is it too late years later?',
      a: 'No. Pelvic floor training helps adult women of many ages. In a Cochrane review of women with stress leaking, 56% of those who trained reported cure, compared with 6% who did not. Most women in the trials were mid-life.',
      sourceId: 'cochraneDumoulin',
      // verified: Dumoulin 2018 CD005654: SUI cure 56% vs 6% (RR 8.38; 4 trials, 165 women; high-quality evidence). Population mostly mid-age women per the 2024 Cochrane update (45-65). "Most women in the trials were mid-life" is from the 2024 companion review abstract; kept general.
    },
    {
      q: 'Can exercises in pregnancy prevent leaking?',
      a: 'They can help. In women who were not leaking, training in pregnancy lowered the chance of leaking in late pregnancy by about 60%, and by about 30% at 3 to 6 months after birth. It does not guarantee prevention, and effects beyond 6 months are unclear.',
      sourceId: 'cochraneWoodley',
      // verified: Woodley 2020 CD007471: continent pregnant women: late pregnancy RR 0.38 (62% less; 6 trials, 624 women; moderate quality); 3-6 months postpartum RR 0.71 (29% less; 5 trials, 673 women; high quality); 6-12 months insufficient information (RR 1.20, 1 trial).
      // softened: "about 60%" and "about 30%". The effect was smaller when offered to all women regardless of continence (22% less in late pregnancy).
    },
    {
      q: 'How do I know I am doing them right?',
      a: 'Squeeze and lift around the wee tube, vagina and back passage while your thighs, bottom and tummy stay relaxed and you breathe normally. If you cannot feel the muscles tighten or let go, or you feel pushing down, ask a pelvic health physio to check.',
      sourceId: 'cha',
      // verified: CHA and PFF technique pages.
    },
    {
      q: 'Should I stop my wee midstream to practise?',
      a: 'Only once, to find the right muscles. Do not make it a regular exercise, because it can affect normal bladder emptying. Practise your squeezes at other times instead.',
      sourceId: 'cha',
      // verified: CHA "Only do this to identify the muscles"; warns against daily practice "as it can affect normal bladder function". PFF: "not recommended as a regular exercise".
    },
    {
      q: 'Can pelvic floor muscles be too tight?',
      a: 'Yes. A tight (overactive) pelvic floor cannot relax well. It can cause pain, constipation, urgency, or trouble emptying the bladder or bowel. Extra squeezing may not help. See a continence physiotherapist if this sounds familiar.',
      sourceId: 'pffHypertonic',
      // verified: PFF hypertonic pelvic floor page: "too tense and can't relax"; symptoms listed; "seeing a continence physiotherapist is essential". "Extra squeezing may not help": softened, the page does not say; general physio teaching.
    },
    {
      q: 'When can I run again after a baby?',
      a: 'Running is not advised before 3 months after birth, and later if you have leaking, heaviness, bulging or pain. A pelvic health physio can check you first. Guidance is mostly expert consensus rather than trial data.',
      sourceId: 'goom2019',
      // verified: Goom, Donnelly & Brockwell (March 2019): Recommendation 2 "Return to running is not advisable prior to 3 months postnatal or beyond this if any symptoms of pelvic floor dysfunction..."; Level 4 evidence. Royal Women's: avoid high-impact exercise in the first 12 weeks.
    },
    {
      q: 'Do tears cause incontinence?',
      a: 'Deeper tears reach the muscle that closes the back passage and can affect bowel control. About 3 in 100 Australian vaginal births (5 in 100 first births) have them. A muscle pulled off the bone is a different injury. A physio can help with both.',
      sourceId: 'apa2025',
      // verified: APA Nov 2025: 2022 births, ~63% vaginal; "third- and fourth-degree perineal tears affected about three per cent (five per cent for first vaginal births)". NICE NG210 1.3.12: consider a supervised 3-month PFMT programme after injury to the anal sphincter.
      // softened: no claim that tears cause urinary leaking; the sources describe the sphincter and bowel side.
    },
    {
      q: 'Forceps versus vacuum: which is worse for the pelvic floor?',
      a: 'In one review of scans, muscle avulsion was found in about 52% after forceps and 21% after vacuum, compared with 15% without instruments. Forceps showed the clearer extra risk. Instruments are sometimes the safest choice for the baby, so this is a decision for your care team.',
      sourceId: 'avulsion2022',
      // verified: LASER (BJOG 2022): forceps 52%, vacuum 21%, spontaneous 15%; ORs vs spontaneous: vacuum 1.66, forceps 6.32.
    },
    {
      q: 'What is prolapse?',
      a: 'Prolapse is when the bladder, womb or bowel slips down into the vagina because support is weak. It can feel like heaviness, dragging or a bulge. Pelvic floor training can help mild to moderate prolapse, and some women use a pessary. See your GP or physio.',
      sourceId: 'informedhealth',
      // verified: IQWiG InformedHealth (updated June 2025): organs "may slip down", "pressure, problems urinating, and pain"; exercises may ease mild to moderate cases; pessaries described. Goom 2019: "Heaviness/dragging in the pelvic area (can be associated with prolapse)".
    },
    {
      q: 'When should I see a physio or GP?',
      a: 'See someone if you leak, feel heaviness or a bulge, have pelvic pain or pain with sex, have trouble emptying your bladder or bowel, or cannot feel the muscles work. If you cannot wee at all with a full bladder, get urgent medical help.',
      sourceId: 'pff',
      // verified: PFF: see a health professional for bladder or bowel control problems, pain, vaginal heaviness or a bulge; if you cannot feel the muscles hold or relax, get assessed. Urgent: healthdirect urinary retention page.
    },
    {
      q: 'Why do so few women ask for help?',
      a: 'Many women think leaking is normal after a baby, feel embarrassed, or are never asked. In one Dutch online survey of 415 mothers, about 1 in 4 who leaked had asked for help. Being asked directly by a clinician can make it easier.',
      sourceId: 'dutchHelp',
      // verified: Moossdorff-Steinhauser et al., Int Urogynecol J 2021 (PMID 33484286): 415 women, 6 weeks to 1 year after birth, social-media recruited; 57.1% reported UI; "In total 25% of UI women sought professional help". Earlier research said 26%; the primary abstract says 25%.
      // softened: "about 1 in 4". Self-selected online sample. "Being asked directly can make it easier" is a general statement; a quantified preference figure was NOT found in an opened source. The 72% / 81% "keeping mum" Australian survey was dropped: the page returned 404 and no date or method could be confirmed.
    },
    {
      q: 'What does the survey or screening questionnaire do?',
      a: 'A short questionnaire helps a clinician spot symptoms that women may not mention themselves, such as leaking, heaviness or pain. If it shows a problem, you can be offered a check and a referral to a pelvic health physio. It is not a diagnosis.',
      sourceId: 'goom2019',
      // verified (generic): Goom 2019 guideline says a validated questionnaire "can provide a useful screen for pelvic floor dysfunction". No tool names or score cut-offs on screen.
    },
    {
      q: 'Are there treatments besides exercises?',
      a: 'Yes. Options include bladder training, treating constipation, a healthy weight, cutting back on caffeine and fizzy drinks, and for prolapse a vaginal pessary. A physio or GP can tailor a plan. NICE also advises supervised training for at least 3 months.',
      sourceId: 'healthdirect',
      // verified: healthdirect urinary incontinence (May 2024): bladder training, cutting back alcohol/fizzy/caffeine, treating constipation, healthy weight. NICE NG210: supported bladder retraining; weight loss advice for BMI over 30; pessary section is for prolapse (it may cause new stress leaking). Pessary for stress leaking is only mentioned in a healthdirect partner resource, so it is NOT claimed for leaking.
    },
    {
      q: 'How long until exercises work?',
      a: 'Many women notice a difference within 6 to 8 weeks of regular practice, and more by 12 weeks and beyond. Keep going after that, as NICE advises continuing if it is helping.',
      sourceId: 'cha',
      // verified: CHA "within 6 to 8 weeks" and "over 12 weeks and beyond". NICE: "If the programme is beneficial, advise women to continue pelvic floor muscle training after the supervised programme ends."
    },
    {
      q: 'When can I start exercises after birth?',
      a: 'You can start in the first few days after birth, when you feel ready and without extra pain. Gentle squeezes can help healing around stitches. A physio check around 6 weeks is recommended.',
      sourceId: 'womens',
      // verified: Royal Women's Hospital Melbourne: "can be safely started when you feel ready", "no increase in your pain", "start in the first few days", "assist with healing around any stitches". APA: six-week postnatal consult.
    },
  ],

  // -------------------------------------------------------------------- Sources
  sources: [
    { id: 'pregPrev', label: 'Moossdorff-Steinhauser et al. 2021. Prevalence of urinary incontinence in pregnancy (44 studies). Int Urogynecol J', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8295103/' },
    { id: 'lien2004', label: 'Lien et al. 2004. Levator ani muscle stretch induced by simulated vaginal birth (computer model). Obstet Gynecol', url: 'https://pubmed.ncbi.nlm.nih.gov/14704241/' },
    { id: 'avulsion2022', label: 'Levator ani avulsion: a systematic evidence review (LASER). BJOG 2022', url: 'https://doi.org/10.1111/1471-0528.16837' },
    { id: 'apa2025', label: 'Australian Physiotherapy Association. Physical birth trauma position statement, Nov 2025', url: 'https://australian.physio/sites/default/files/Physiotherapy-Physical-Birth-Trauma-Position-Statement-Nov2025.pdf' },
    { id: 'postpartum2010', label: 'Prevalence of postpartum urinary incontinence: a systematic review. Acta Obstet Gynecol Scand 2010', url: 'https://pubmed.ncbi.nlm.nih.gov/21050146/' },
    { id: 'postpartum2021', label: 'Prevalence, incidence and bothersomeness of urinary incontinence between 6 weeks and 1 year post-partum. Int Urogynecol J 2021', url: 'https://pubmed.ncbi.nlm.nih.gov/34142179/' },
    { id: 'gyhagen2013', label: 'Gyhagen et al. 2013. Prevalence of urinary incontinence 20 years after childbirth (Swedish national cohort). BJOG', url: 'https://doi.org/10.1111/j.1471-0528.2012.03301.x' },
    { id: 'persistent12y', label: 'Urinary incontinence persisting after childbirth: 12-year longitudinal cohort. BJOG 2015', url: 'https://pubmed.ncbi.nlm.nih.gov/25846816/' },
    { id: 'south2009', label: 'South et al. 2009. Levator ani denervation and reinnervation 6 months after childbirth. Am J Obstet Gynecol', url: 'https://pubmed.ncbi.nlm.nih.gov/19268880/' },
    { id: 'cochraneWoodley', label: 'Woodley et al. 2020. Pelvic floor muscle training for preventing and treating urinary and faecal incontinence in antenatal and postnatal women. Cochrane CD007471', url: 'https://doi.org/10.1002/14651858.CD007471.pub4' },
    { id: 'cochraneDumoulin', label: 'Dumoulin et al. 2018. Pelvic floor muscle training versus no treatment for urinary incontinence in women. Cochrane CD005654', url: 'https://doi.org/10.1002/14651858.CD005654.pub4' },
    { id: 'cha', label: 'Continence Health Australia. Pelvic floor muscle training for women', url: 'https://www.continence.org.au/information-incontinence-english/pelvic-floor-muscle-training-for-women' },
    { id: 'pff', label: 'Pelvic Floor First. Pelvic floor muscle exercises for women', url: 'https://pelvicfloorfirst.org.au/pages/pelvic-floor-muscle-exercises-for-women.html' },
    { id: 'pffHypertonic', label: 'Pelvic Floor First. The hypertonic pelvic floor', url: 'https://pelvicfloorfirst.org.au/news/577/the-hypertonic-pelvic-floor' },
    { id: 'helpline', label: 'Continence Health Australia. National Continence Helpline', url: 'https://www.continence.org.au/national-continence-helpline' },
    { id: 'womens', label: 'The Royal Women\'s Hospital. Exercise after birth', url: 'https://www.thewomens.org.au/health-information/pregnancy-and-birth/your-health-after-birth/exercise-after-birth' },
    { id: 'goom2019', label: 'Goom, Donnelly & Brockwell 2019. Returning to running postnatal: guideline for medical, health and fitness professionals', url: 'https://athleticsni.org/download/files/Returning_to_running_postnatal_guideline_for_medical_health_and_fitness_professionals_managing_this_population.05.pdf' },
    { id: 'dutchHelp', label: 'Urinary incontinence 6 weeks to 1 year post-partum: prevalence, bother, beliefs and help-seeking (Netherlands). Int Urogynecol J 2021', url: 'https://pubmed.ncbi.nlm.nih.gov/33484286/' },
    { id: 'nice', label: 'NICE NG210. Pelvic floor dysfunction: prevention and non-surgical management', url: 'https://www.nice.org.uk/guidance/ng210/chapter/Recommendations' },
    { id: 'healthdirect', label: 'healthdirect Australia. Urinary incontinence', url: 'https://www.healthdirect.gov.au/urinary-incontinence' },
    { id: 'retention', label: 'healthdirect Australia. Urinary retention', url: 'https://www.healthdirect.gov.au/urinary-retention' },
    { id: 'informedhealth', label: 'IQWiG InformedHealth. Pelvic floor exercises and vaginal pessaries for pelvic organ prolapse', url: 'https://www.informedhealth.org/pelvic-floor-exercises-and-vaginal-pessaries-for-pelvic-organ-prolapse.html' },
    { id: 'teachme', label: 'TeachMeAnatomy. The pelvic floor', url: 'https://teachmeanatomy.info/pelvis/muscles/pelvic-floor/' },
  ],
};
