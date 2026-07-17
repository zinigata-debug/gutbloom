import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabaseClient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as Localization from 'expo-localization';
import * as NativeSplash from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  AppState,
  Dimensions,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, Line, Path, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { SafeAreaProvider, SafeAreaView as SafeAreaViewSC, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FERMENTATION_I18N, PATTERN_I18N, RECIPES_I18N, SWAPS_I18N, GROUPS_I18N, LIGHTEN_TIPS } from './translations_medical';
import { getElevation } from './elevation';
import { Surface } from './Surface';

// Keep the native launch splash (configured in app.json, same #e7f3df background)
// visible until our JS splash mounts. Without this, the OS hides its splash the
// instant JS starts, exposing the bare app icon / launch-zoom before our animated
// SplashScreen renders. Hidden in SplashScreen's mount effect for a seamless handoff.
NativeSplash.preventAutoHideAsync().catch(() => {});

const { width } = Dimensions.get('window');

// Mirrors the OS "Reduce Motion" accessibility setting. Synced once on mount in App
// (and on change), so animation components can skip non-essential motion. Module-level
// because most animated components don't receive props and read it at animation time.
let _reduceMotion = false;

// ─── INTERNATIONALIZATION ────────────────────────────────────────────────
// Phase 1: UI chrome in 5 languages. Long-form content (GutGuide answers,
// food names, swaps) is still English and handled in later phases.
// Language is auto-detected from the phone; unsupported languages fall back
// to English. A manual override lives in Settings.
const SUPPORTED_LANGS = ['en', 'de', 'es', 'fr', 'it'];

const STRINGS = {
  en: {
    // Account / authentication
    account: 'Account', account_sub: 'Sign in to back up and sync your journey across devices.',
    account_signed_in: 'Signed in', account_manage: 'Manage account',
    sign_in: 'Sign in', sign_up: 'Create account', sign_out: 'Sign out',
    auth_title_login: 'Welcome back', auth_title_signup: 'Create your account', auth_title_reset: 'Reset password',
    auth_sub_login: 'Sign in to sync your gut journey across devices.',
    auth_sub_signup: 'Your data stays yours — an account backs it up and keeps it in sync.',
    auth_sub_reset: "Enter your email and we'll send you a reset link.",
    auth_email: 'Email', auth_email_ph: 'you@example.com',
    auth_password: 'Password', auth_password_ph: 'At least 6 characters',
    auth_forgot: 'Forgot password?',
    auth_to_signup: 'New here? Create an account', auth_to_login: 'Already have an account? Sign in',
    auth_send_reset: 'Send reset link', auth_back_to_login: 'Back to sign in',
    auth_err_empty: 'Please enter your email and password.',
    auth_err_email: 'Please enter a valid email address.',
    auth_err_password_short: 'Password must be at least 6 characters.',
    auth_err_generic: 'Something went wrong. Please try again.',
    auth_err_credentials: 'Wrong email or password.',
    auth_err_exists: 'That email is already registered — try signing in.',
    auth_err_send: "We couldn't send the confirmation email. Check the address or try again shortly.",
    auth_err_unconfirmed: 'Please confirm your email first — check your inbox.',
    auth_err_mismatch: 'Passwords do not match.',
    auth_confirm_password: 'Confirm password', auth_confirm_password_ph: 'Re-enter your password',
    auth_show_password: 'Show password', auth_hide_password: 'Hide password',
    auth_sent_title: 'Check your email', auth_sent_body: 'We sent a confirmation link to {email}. Open it to activate your account, then come back and sign in.',
    auth_reset_sent_body: 'If {email} has an account, a password reset link is on its way. Open it to choose a new password.',
    account_nudge_title: 'Save your progress', account_nudge_sub: 'Create a free account to back up your diary and colony.', account_nudge_cta: 'Create free account', account_nudge_row_sub: 'Back up your diary & colony',
    levelup_save_cta: 'Save your colony — create a free account',
    auth_check_email: 'Almost there! Check your email to confirm your account, then sign in.',
    auth_reset_sent: 'If that email is registered, a reset link is on its way.',
    auth_signed_out: 'Signed out.', auth_welcome_toast: 'Signed in. Welcome back! 🌱',
    auth_linked_note: 'Your existing data is now linked to your account.',
    sync_now: 'Sync now', sync_syncing: 'Syncing…', sync_last: 'Last synced {time}', sync_never: 'Not synced yet', sync_failed: 'Sync failed — will retry.',
    account_sync_sub: 'Your logs and custom foods back up and sync automatically.',
    continue: 'Continue', back: 'Back', save: 'Save', close: 'Close', gotIt: 'Got it', a11y_clear: 'Clear search', a11y_remove: 'Remove', a11y_add_log: 'Add log entry',
    cancel: 'Cancel', done: 'Done', skip: 'Skip',
    tab_home: 'Today', tab_foods: 'Foods', tab_plan: 'My Plan', tab_guide: 'GutGuide',
    onb_name_q: "What's your name?", onb_name_sub: 'Just your first name is fine.', onb_name_ph: 'Your name',
    onb_safety_q: 'Before we begin', onb_safety_sub: 'A quick health check — this matters.',
    onb_start: 'Start GutBloom',
    home_greeting: 'Hi',
    home_patterns: 'My patterns', home_todays_meals: "Today's meals",
    foods_title: 'Food Explorer', foods_sub: 'Search any food, see triggers and safe portions',
    foods_search: 'Search any food', foods_count: '{n} foods',
    foods_no_results: 'No foods match these filters.', foods_clear_filters: 'Clear filters',
    filter_all: 'All', filter_dishes: 'Dishes', filter_high: 'High', filter_mod: 'Moderate', filter_low: 'Low',
    filter_category: 'Category', cat_modal_title: 'Filter by category', cat_modal_clear: 'Clear', cat_modal_done: 'Show {n} foods',
    grp_fruit: 'Fruit', grp_veg: 'Vegetables', grp_dairy: 'Dairy', grp_protein: 'Protein', grp_grain: 'Grains', grp_drink: 'Drinks', grp_nut: 'Nuts & seeds', grp_sauce: 'Sauces', grp_sweet: 'Sweets', grp_legume: 'Legumes',
    plan_title: 'My Plan',
    guide_title: 'GutGuide', guide_sub: '50 honest answers to common FODMAP questions',
    guide_search: 'Search questions',
    log_meal: 'Log meal', log_symptom: 'Log symptom', log_sleep: 'Log sleep', log_stress: 'Log stress',
    log_water: 'Log water', log_water_sub: 'Track your hydration', water_title: 'Water', water_amount_label: 'How many glasses did you drink?', water_glasses_one: '{n} glass', water_glasses: '{n} glasses', water_unit_hint: '1 glass ≈ 200 ml', water_why_title: 'Why hydration matters', water_why: 'Staying hydrated keeps digestion moving and stools soft — it helps prevent the constipation and bloating that often come with IBS, especially as you adjust your fibre.', lf_water_title: 'Nicely done', lf_water_msg: 'Every glass helps your gut keep things moving.', lf_water_goal_title: 'Hydration goal reached!', lf_water_goal_msg: 'All {goal} glasses done — about {liters} L today. Your gut loves the steady flow.', edit_water_label: 'Glasses', water_progress: '{n} / {goal} glasses · ≈ {liters} L', water_goal_reached: 'Goal reached — nicely hydrated!',
    settings: 'Settings', upgrade: 'Upgrade to Premium', premium_active: 'GutBloom Premium',
    paywall_cta: 'Get Premium', plan_annual: 'Annual', plan_monthly: 'Monthly',
    save_meal: 'Save meal', doctor_summary: 'Doctor summary',
    lang_label: 'Language', lang_auto: 'Automatic (phone language)',
    foods_src_note: "Food guidance is based on established low-FODMAP principles as general guidance, not lab-tested values. Monash University's FODMAP app is the clinical reference for precise thresholds.",
    detail_trigger_head: "How often it's a trigger", detail_portion_head: 'Portion guidance',
    detail_swap_head: 'Eat this instead', detail_why_head: 'Why it triggers',
    detail_swap_sub: "You don't have to give up the flavour — these low-FODMAP swaps do the same job.",
    detail_lighten_head: 'How to make it low-FODMAP', detail_lighten_sub: 'Small changes that cut the FODMAP load — same taste, easier on the gut.',
    detail_tolerate: 'YOU TOLERATE THIS', detail_trigger: 'THIS TRIGGERS YOU',
    detail_cross_warn: 'Cross-intolerance warning',
    detail_hist_high: 'High in histamine — likely problematic if you react to aged or fermented foods.',
    fermented_tolerance_note: 'Fermented — often tolerated better than regular dairy',
    small_portion_note: 'Fine in a small portion (about 40g)',
    food_base_note: 'Base recipe — add your own ingredients',
    detail_hist_mod: 'Moderate histamine — usually tolerated in small portions.',
    detail_hist_lib: 'Histamine liberator — does not contain histamine but can trigger your body to release it.',
    detail_profile_note: 'Based on your profile. Adjust in Settings.',
    detail_portion_safe: 'Safe at any portion',
    detail_portion_low_then: 'Low up to {g}g, then moderate',
    detail_portion_low: 'Up to {g}g — Low FODMAP',
    detail_portion_mod: '{lo}–{hi}g — Moderate',
    detail_portion_high_label: 'Above {g}g — High',
    detail_portion_high_note: 'High FODMAP at any portion. Avoid during elimination.',
    detail_ferm_good: 'GOOD TO KNOW', detail_ferm_caution: 'HEADS UP', detail_ferm_mixed: 'MIXED PICTURE',
    detail_trigger_note: 'A general guide for people with IBS. Your own tolerance is what matters — the reintroduction phase is how you find it.',
    band_common: 'Commonly a trigger', band_sometimes: 'Sometimes a trigger', band_rarely: 'Rarely a trigger',
    band_common_s: 'Common trigger', band_sometimes_s: 'Sometimes', band_rarely_s: 'Rarely',
    recipes_title: 'Recipes',
    recipes_flora_sub: 'Gut-friendly meals Flora loves to cook',
    recipes_upsell_headline: 'Cook without limits',
    recipes_upsell_sub: 'You\'ve tried {free} of {total} recipes — here\'s everything else.',
    recipes_upsell_bullet1: 'All {n} gut-friendly recipes',
    recipes_upsell_bullet2: 'Full step-by-step reintroduction plan',
    recipes_upsell_bullet3: 'Doctor-ready data export',
    recipes_unlock_btn: 'Unlock Premium',
    recipe_premium_locked: 'Premium recipe — tap to unlock',
    recipe_meta: '{meal} · {min} min · {ing} ingredients',
    recipe_badge_safe: 'ELIMINATION-SAFE',
    recipe_ingredients: 'Ingredients',
    recipe_steps: 'Steps',
    recipe_log_btn: 'Log as meal',
    meal_breakfast: 'Breakfast', meal_lunch: 'Lunch', meal_dinner: 'Dinner', meal_snack: 'Snack',
    guide_count: '{n} questions', guide_no_results: 'No questions match that search. Try a different word or topic.',
    guide_flora_title: 'Curious about FODMAP?',
    guide_flora_sub: 'Flora has honest, clear answers to the most common questions.',
    scan_limit_title: 'Monthly scans used up',
    scan_limit_body: 'You have used all {n} AI scans for this month. Your allowance resets at the start of next month. In the meantime, you can still log meals by search or barcode — both unlimited.',
    paywall_includes: 'What Premium includes',
    pattern_watch: 'Worth watching', pattern_noticed: 'Noticed', pattern_good: 'Good sign',
    patterns_empty: 'Keep logging meals and how you feel. Patterns usually start to show after about a week of data.',
    export_share: 'Share summary',
    export_share_again: 'Share again',
    export_modal_title: 'Doctor summary',
    export_appt_title: 'A summary for your appointment',
    export_appt_body: 'This compiles your logged data, reintroduction results and observed patterns into one summary you can send to your doctor or dietitian. Tap Share to send it by email, messaging, or save it as a note.',
    export_preview_label: 'Preview',
    export_shared: 'Shared!',
    export_shared_note: 'Summary shared. You can send it again anytime.',
    export_disclaimer: 'This reflects self-reported data and supports — does not replace — professional medical assessment.',
    recipe_how_to: 'How to make it',
    recipe_log_full_btn: 'I made this · Log as meal',
    recipe_portions_note: 'Portions are guidelines. Check the Food Explorer for safe limits on moderate-FODMAP ingredients.',
    settings_premium_sub: 'Full reintroduction, all recipes, doctor export. No ads, ever.',

    // Safety step
    safety_ibs_q: 'Have you been diagnosed with IBS by a doctor?',
    safety_yes: 'Yes', safety_no: 'No', safety_unsure: 'Not sure',
    safety_no_diag_note: 'The low-FODMAP diet is designed as a tool after an IBS diagnosis. The same symptoms can come from other conditions that need different treatment, so it is worth seeing a doctor first. You can still explore GutBloom to learn.',
    safety_flags_q: 'Are you experiencing any of these?',
    safety_flags_sub: 'Tick anything that applies. Leave blank if none.',
    safety_flag_blood: 'Blood in your stool',
    safety_flag_weightloss: 'Unexplained weight loss',
    safety_flag_newover50: 'New gut symptoms that started after age 50',
    safety_flag_famhistory: 'Family history of bowel cancer, celiac or IBD',
    safety_flag_anemia: 'Anemia or low iron',
    safety_flag_fever: 'Fever alongside your gut symptoms',
    safety_flag_nightwake: 'Symptoms that wake you from sleep',
    safety_warn_title: 'Please see a doctor before changing your diet',
    safety_warn_body: 'Some of what you ticked are symptoms doctors call "red flags." They do not mean something is seriously wrong — but they do mean you should be assessed before starting a restrictive diet, because changing how you eat can mask something that needs proper attention.',
    safety_warn_ack: 'I understand and have decided to continue.',

    // Onboarding steps
    onb_step: 'Step {n} of {total}',
    onb_flora_intro: "Hi, I'm Flora — your gut buddy",
    onb_ibs_q: 'What is IBS?',
    onb_ibs_card1_title: 'A very common condition',
    onb_ibs_card1_body: "Irritable Bowel Syndrome (IBS) affects around 1 in 10 people worldwide. It's not a disease — it's a functional gut disorder, meaning the gut is sensitive and reactive, but not damaged.",
    onb_ibs_card2_title: 'The symptoms',
    onb_ibs_card2_body: 'Bloating, cramping, stomach pain, diarrhea, constipation — or a mix that shifts day to day. Symptoms are real and can significantly affect daily life, even though tests often come back normal.',
    onb_ibs_card3_title: 'The good news',
    onb_ibs_card3_body: "IBS is manageable. Diet, stress, sleep, and understanding your personal triggers all make a real difference. That's exactly what GutBloom helps you do.",
    onb_menstruate_q: 'Do you menstruate?',
    onb_menstruate_sub: "Hormonal cycles can amplify IBS symptoms 30-40%. If yes, we'll help you spot cycle-related patterns. You can change this anytime in Settings.",
    onb_menstruate_yes: 'Yes', onb_menstruate_no: 'No',
    onb_fodmap_q: 'What is FODMAP?',
    onb_fodmap_card1_title: 'A group of fermentable sugars',
    onb_fodmap_card1_body: "FODMAP stands for Fermentable Oligosaccharides, Disaccharides, Monosaccharides And Polyols — a family of short-chain carbs found in many everyday foods. In sensitive guts, they're poorly absorbed and fermented by bacteria, which causes gas, bloating, and pain.",
    onb_fodmap_card2_title: 'The low-FODMAP diet',
    onb_fodmap_card2_body: "Developed by Monash University, it's the most evidence-based dietary approach for IBS. You temporarily cut high-FODMAP foods to calm your gut, then systematically reintroduce them to find your personal triggers.",
    onb_fodmap_card3_title: 'Two phases, one goal',
    onb_fodmap_card3_body: 'Phase 1 — Elimination (~4–6 weeks): cut the triggers, calm the gut. Phase 2 — Reintroduction (~8 weeks): test each FODMAP group to find exactly which foods are a problem for you. Most people end up with a surprisingly varied diet.',
    onb_phase_q: 'Where are you with FODMAP?',
    onb_phase_sub: "We'll guide you from wherever you are.",
    onb_phase_learning: 'Just learning about it', onb_phase_curious: 'Considering trying it',
    onb_phase_elimination: 'In elimination phase', onb_phase_reintro: 'Ready to reintroduce',
    onb_phase_maintenance: 'Done with formal phases',
    onb_symptom_q: 'Main symptom?', onb_symptom_sub: 'Tap whatever sounds most like you.',
    onb_symptom_bloat: 'Bloating after meals', onb_symptom_pain: 'Stomach pain or cramping',
    onb_symptom_bowel: 'Diarrhea or constipation', onb_symptom_multi: 'Multiple symptoms',
    onb_known_q: 'Any known intolerances?', onb_known_sub: 'Tap all that apply. Skip if unsure.',
    onb_known_lactose: 'Lactose', onb_known_gluten: 'Gluten / Celiac',
    onb_known_fructose: 'Fructose', onb_known_histamine: 'Histamine', onb_known_unknown: "Don't know yet",
    onb_sleep_q: 'How is your sleep?', onb_sleep_sub: 'Sleep affects gut symptoms more than most realize.',
    onb_sleep_great: '7-9 hours, well-rested', onb_sleep_okay: '6-7 hours, mostly fine', onb_sleep_poor: 'Less than 6h or restless',
    onb_stress_q: 'Stress level?', onb_stress_sub: 'Stress and gut go hand in hand.',
    onb_stress_low: 'Mostly calm', onb_stress_mid: 'Manageable', onb_stress_high: 'High stress',

    // Home screen — empty state
    home_empty_title: "Let's take care of your gut",
    home_empty_body: 'Track your meals and how you feel, spot patterns, and learn what your gut loves — one day at a time, with Flora by your side.',
    home_before_start: 'BEFORE YOU START',
    home_gp_title: 'See your GP or a gastroenterologist',
    home_gp_sub: 'FODMAP is a tool used after an IBS diagnosis. Tap to see how they help.',
    home_gp_confirm: 'Confirm it\'s IBS — and rule out other causes',
    home_gp_confirm_body: 'Symptoms like yours can also come from coeliac disease or inflammatory bowel disease. Your GP (regular doctor) can run initial tests — a blood screen and inflammation markers — and refer you to a gastroenterologist if needed.',
    home_diagnosed: "I've been to the doctor and got diagnosed",
    home_how_it_works: 'HOW IT WORKS',
    home_how_intro: 'IBS symptoms are often set off by certain foods — but the triggers are different for everyone. GutBloom guides you through a proven two-phase method to find yours.',
    home_step1_title: 'Log meals & how you feel', home_step1_sub: 'Quick search, barcode, or AI scan',
    home_step2_title: 'Elimination phase', home_step2_sub: 'For 4–6 weeks you eat simple, gut-friendly foods that rarely cause trouble. This calms your gut and gives you a clear, symptom-free baseline.',
    home_step3_title: 'Reintroduction phase', home_step3_sub: 'You add foods back one at a time and watch how your body reacts — this is how you pinpoint which foods are really your triggers, and which are safe.',
    home_step4_title: 'Eat with confidence', home_step4_sub: 'Build your personal list of safe foods and known triggers, so you can enjoy meals with fewer flare-ups.',
    home_how_note: 'Based on the low-FODMAP approach for IBS. GutBloom is here to support you, but it isn\'t medical advice — check with your doctor or dietitian.',
    home_how_more: 'Read more', home_how_less: 'Show less',
    home_start_elim: 'Start Elimination Phase',
    home_lets_start: "Let's get started",

    // Home screen — hasData
    home_today: 'Today', home_yesterday: 'Yesterday', home_journal: 'Journal', history_title: 'History', see_history: 'See all log entries', home_see_progress: 'See My Progress', patterns_see_all: 'See all patterns',
    home_hi_name: 'Hi {name}', home_hi: 'Hi there', home_journey_day: 'Day {n} of your gut journey', home_eat_well: 'Eat well today', picker_select_day: 'Select a day', meal_select_type: 'Select a Type', progress_level_points: 'Level {level} · {points} points', a11y_take_photo: 'Take photo', a11y_week_number: 'Week number', a11y_week_decrease: 'Decrease week', a11y_week_increase: 'Increase week', week_number_ph: 'e.g. 2',
    recipes_all: 'All recipes', home_meals_sub: '4 elimination-safe meals picked for you. Tap any to see it.', patterns_empty_early: 'Keep logging meals and how you feel. Patterns usually start to show after about a week of data.', patterns_empty_none: 'No clear patterns yet. Keep logging — the more consistent your entries, the sharper the insights.', patterns_sub: 'Correlations from your log — not diagnoses. Use them to decide what to test.', patterns_window: 'Last {n} days', sev_watch: 'WORTH WATCHING', sev_maybe: 'EARLY SIGN', sev_info: 'NOTICED', sev_good: 'GOOD SIGN', show_less: 'Show less', show_more: 'Show {n} more',
    colony_lv: 'Lv {n} · {form}', colony_pts: '{n} points', colony_form_spore: 'Spore', colony_form_sprout: 'Sprout', colony_form_grown: 'Grown', colony_form_thriving: 'Thriving', colony_level_form: 'Level {n} · {form}',
    home_low_fodmap: 'Low-FODMAP', home_symptoms: 'Symptoms', home_sleep: 'Sleep',
    home_colony_title: "Flora's colony", home_see_colony: 'See Colony',
    home_colony_complete: 'Complete',
    home_colony_thriving: 'Colony complete — keep it up!',
    home_days_thriving: '{n} {unit} thriving',
    home_day: 'day', home_days: 'days',
    home_to_level: 'to level {n}',

    // Period card
    period_turn_on: 'Turn on when your period starts',
    period_turn_off: 'Turn off when it ends',
    period_active: 'Period active', period_tracking: 'Period tracking',
    period_body: 'Hormones can amplify gut symptoms by 30–40% around your period. Tracking it lets GutBloom tell cycle effects apart from real food triggers — keeping your patterns accurate.',

    // Timeline
    timeline_entries: '{n} entries - tap to edit',
    timeline_intensity: 'Intensity {n}/5',
    timeline_stress: 'Stress level {n}/5',
    timeline_meal_fallback: 'Meal',
    timeline_extra_one: '+ {n} ingredient', timeline_extra: '+ {n} ingredients',

    // Phase progress widget
    phase_ready_title: 'Ready to start?',
    phase_ready_body: 'Begin the elimination phase to identify your triggers. Lasts 4-6 weeks.',
    phase_plan_link: 'See My Plan',
    phase_elim_badge: 'RESET PHASE · WEEK {n}',
    phase_elim_headline_1: "You've taken care of yourself for 1 day",
    phase_elim_headline_n: "You've taken care of yourself for {n} days",
    phase_elim_body_early: 'Most people feel a real difference around week 2-3. You\'re building a clearer baseline every day.',
    phase_elim_body_ready: "Your body has had time to calm down. When you're ready, we'll start gently adding foods back.",
    phase_reintro_badge: 'REINTRODUCTION PHASE',
    phase_reintro_headline: 'Week {n} of ~{total}',
    phase_reintro_body: 'Testing one FODMAP group at a time. See your full plan in the My Plan tab.',

    // Mood from score
    mood_null_title: "Let's see how today goes",
    mood_null_sub: 'Log a meal or symptom and Flora will react.',
    mood_good_title: 'Flora feels calm today',
    mood_good_sub_streak: 'No flare-ups in {n} {unit}. Keep it steady.',
    mood_good_sub: 'Your gut is having a good day.',
    mood_soso_title: 'A so-so day',
    mood_soso_sub: 'Mixed signals today — keep logging to spot the cause.',
    mood_bad_title: 'Flora is feeling rough',
    mood_bad_sub: 'A harder gut day. Be gentle with yourself.',

    // Colony modal
    colony_title: "Flora's colony",
    colony_thriving: 'Thriving colony 🎉',
    colony_points_all: '{n} points · all 12 microbes',
    colony_points: '{n} points · {to} to level {next}',
    colony_earned: "How you've earned points",
    colony_row_symFree: 'Symptom-free days', colony_row_symFree_how: '+20 each calm day',
    colony_row_meals: 'Low-FODMAP meals', colony_row_meals_how: '+5 per safe meal (max 3/day)',
    colony_row_logging: 'Daily logging', colony_row_logging_how: '+10 for logging anything that day',
    colony_row_reintro: 'Reintro tests done', colony_row_reintro_how: '+50 per completed test',
    colony_footer: 'Flora grows as your gut habits do. Rough days never cost you points — consistency is what counts.',

    // Level up celebration
    levelup_badge_complete: '🎉 COLONY COMPLETE',
    levelup_title_complete: 'A full, thriving colony!',
    levelup_body_complete: "You've grown all 12 microbes — a diverse, healthy gut community. Now keep it thriving.",
    levelup_badge: 'LEVEL UP',
    levelup_title: 'Level {n}',
    levelup_body: 'Flora is now {form}! Your gut habits are paying off.',
    levelup_member_badge: 'NEW COLONY MEMBER',
    levelup_member_body: 'A new microbe just joined Flora’s colony — your gut habits are paying off.',
    levelup_btn: 'Nice!',

    // Log feedback
    lf_meal_low_title: 'Gentle choice!', lf_meal_low_msg: 'That meal looks easy on your gut. Flora approves.',
    lf_meal_mod_title: 'Moderate meal', lf_meal_mod_msg: 'Fine in smaller portions — watch out for stacking today.',
    lf_meal_high_title: 'High-FODMAP meal', lf_meal_high_msg: 'This one might stir things up. Notice how you feel later.',
    lf_symptom_high_title: 'Hang in there', lf_symptom_high_msg: "Sorry you're not feeling great. Logging it helps find the cause.",
    lf_symptom_low_title: 'Noted', lf_symptom_low_msg: 'Got it logged. Hope it eases soon.',
    lf_sleep_great_title: 'Well rested!', lf_sleep_great_msg: 'Good sleep helps your gut recover. Nice work.',
    lf_sleep_ok_title: 'Okay night', lf_sleep_ok_msg: 'Decent rest — a little more would help your gut.',
    lf_sleep_short_title: 'Short night', lf_sleep_short_msg: 'Low sleep can amplify symptoms. Be kind to yourself today.',
    lf_stress_low_title: 'Nice and calm', lf_stress_low_msg: 'Low stress is great for your gut. Keep it up.',
    lf_stress_mid_title: 'Manageable', lf_stress_mid_msg: 'A middling day — a few deep breaths can help.',
    lf_stress_high_title: 'High stress', lf_stress_high_msg: 'Stress and gut go hand in hand. Try to decompress a little.',
    lf_got_it: 'Got it',

    // Progress modal
    progress_title: 'My progress',
    progress_last7: 'LAST 7 DAYS',
    progress_gut_score: 'gut score',
    progress_calm_days: 'Calm days',
    progress_adherence: 'Adherence',
    progress_avg_sleep: 'Avg sleep',
    progress_adherence_title: 'Low-FODMAP adherence',
    progress_adherence_sub: 'Share of meals within safe foods',
    progress_symptoms_title: 'Symptoms',
    progress_symptoms_sub: 'Fewer is better',
    progress_symptoms_this_week: '{n} this week',
    progress_sleep_title: 'Sleep',
    progress_sleep_sub: 'Hours per night',
    progress_sleep_avg: '{n}h avg',
    progress_avg_water: 'Avg water',
    progress_water_title: 'Water',
    progress_water_sub: 'Glasses per day',
    progress_water_avg: '{n} avg',
    progress_score_null: 'Keep logging to see your weekly score',
    progress_score_good: 'Your gut had a calm, steady week',
    progress_score_mid: 'A mixed week — a few things to spot',
    progress_score_bad: 'A tougher week — be gentle with yourself',
    progress_flora_body: 'Flora grows as your weekly habits hold steady.',

    // Log type chooser
    log_chooser_title: 'What to log?',
    log_meal_sub: 'Search foods, scan, or AI parse',
    log_symptom_sub: 'Log how you feel',
    log_sleep_sub: 'Track hours',
    log_stress_sub: 'Capture stress level',
    nudge_lifestyle: 'Add sleep, stress & water too — it sharpens your patterns.',

    // Sleep modal
    sleep_title: 'Log sleep',
    sleep_hours_label: 'Hours slept: {n}h',

    // Stress modal
    stress_title: 'Log stress',
    stress_label: 'Stress: {label}',
    stress_calm: 'Calm', stress_mild: 'Mild', stress_manageable: 'Manageable',
    stress_tense: 'Tense', stress_overwhelmed: 'Overwhelmed',

    // Symptom modal
    symptom_title: 'Log symptom',
    symptom_q: 'What are you feeling?',
    symptom_intensity: 'Intensity ({n}/5)',
    symptom_log_btn: 'Log',
    symptom_bloating: 'Bloating', symptom_pain: 'Pain', symptom_gas: 'Gas',
    symptom_diarrhea: 'Diarrhea', symptom_constipation: 'Constipation', symptom_nausea: 'Nausea',

    // Paywall modal
    paywall_headline_default: 'Unlock the full GutBloom journey',
    paywall_sub_default: 'Premium gives you everything you need for the full elimination-to-reintroduction journey.',
    paywall_headline_reintro: 'Unlock your full reintroduction',
    paywall_sub_reintro: 'You finished your first food challenge. Premium unlocks the remaining five FODMAP groups — the part that gives you your full personal list of safe foods.',
    paywall_headline_recipes: 'Unlock all 50+ recipes',
    paywall_sub_recipes: 'You have explored the free recipes. Premium opens the complete library of elimination-safe meals across every cuisine.',
    paywall_headline_history: 'See your full pattern history',
    paywall_sub_history: 'Free shows this week. Premium keeps your full history so you can see patterns build over months.',
    paywall_headline_export: 'Export your data for your doctor',
    paywall_sub_export: 'Generate a clean PDF of your symptoms, triggers and progress to share with your doctor or dietitian.',
    paywall_headline_scan: 'AI meal scanning is a Premium feature',
    paywall_sub_scan: 'Snap a photo of a meal for a quick FODMAP estimate. Premium includes 30 scans a month. Food search and barcode scanning stay free and unlimited.',
    paywall_feat_reintro: 'Full reintroduction', paywall_feat_reintro_sub: 'Test all 6 FODMAP groups, not just the first',
    paywall_feat_recipes: 'All 50+ recipes', paywall_feat_recipes_sub: 'Every elimination-safe meal, all cuisines',
    paywall_feat_scan: 'Your personal FODMAP map', paywall_feat_scan_sub: 'See exactly which foods and portions work for you',
    paywall_feat_history: 'Full pattern history', paywall_feat_history_sub: 'See trends build over months, not just this week',
    paywall_feat_export: 'Doctor-ready export', paywall_feat_export_sub: 'A clean PDF of your data for appointments',
    paywall_free_note: 'Food lookup, barcode scanning, logging, GutGuide and the full elimination phase stay free — always. Premium unlocks the reintroduction journey and everything that follows.',
    paywall_best_badge: 'BEST FOR THE JOURNEY',
    paywall_trial_note: '{price}. Cancel anytime. No ads, ever.',
    paywall_trial_btn: 'Get Premium',
    paywall_annual_price: '€69/year · about €5.75/month',
    paywall_monthly_price: '€8.99/month',
    annual: 'Annual', monthly: 'Monthly',

    // Settings modal
    settings_title: 'Settings',
    settings_premium_active_sub: 'Your full journey is unlocked. Thank you for the support.',
    settings_mid_journey: 'Already mid-journey? Update your phase manually.',
    settings_current_phase: 'Current phase',
    settings_phase_not_started: 'Not started yet',
    settings_phase_elimination: 'Elimination',
    settings_phase_reintroduction: 'Reintroduction',
    settings_week_label: 'Already on Week #',
    settings_week_sub: "We'll set your start date back accordingly.",
    settings_menstruate_q: 'Do you menstruate?',
    settings_menstruate_sub: 'If yes, we surface a period tracker on Home to help you spot hormone-related patterns.',
    settings_other_intolerances: 'Other intolerances', settings_none: 'None',
    settings_other_intolerances_sub: "We'll flag foods that are low-FODMAP but problematic for these.",
    settings_doctor_summary: 'Doctor summary', settings_doctor_export_btn: 'Export doctor summary',
    settings_doctor_sub: 'Export your data as a summary to share with your doctor or dietitian.',
    settings_save_phase: 'Save phase changes',
    settings_custom_foods: 'Your custom foods', settings_custom_foods_sub: 'Foods you added yourself. Tap a dot to change its FODMAP level, or ✕ to remove.',
    settings_start_over: 'Start over',
    settings_start_over_sub: "Clears all your data — profile, logs, and progress — and replays onboarding. This can't be undone.",
    settings_reset_confirm: 'Yes, erase everything',
    settings_reset_btn: 'Reset app',
    settings_disclaimer_title: 'Health disclaimer',
    settings_disclaimer_body: 'GutBloom is a wellness and tracking tool — not a medical device, and not a substitute for professional medical advice, diagnosis, or treatment. It does not diagnose conditions or replace your doctor. Always seek the advice of your physician or a qualified health provider with any questions about a medical condition, and never disregard or delay professional advice because of something in this app. The low-FODMAP journey is best done with an IBS diagnosis and the support of a FODMAP-trained dietitian. If you have severe or alarming symptoms, contact a medical professional.',
    settings_terms: 'Terms of Service', settings_privacy: 'Privacy Policy',

    // Plan screen
    plan_sub: 'Your two-phase FODMAP path',
    plan_period_pause: 'Consider pausing',
    plan_period_pause_sub: 'Period can amplify symptoms 30-40%.',
    plan_phase1_eyebrow: 'PHASE 1', plan_phase1_title: 'Elimination',
    plan_phase1_body: 'We take a temporary break from common trigger foods to calm your gut and create a clean baseline — so reactions are easier to spot later.',
    plan_elim_in_progress: 'In progress — see foods on pause in your home screen',
    plan_elim_done: 'Done — your gut had time to calm down',
    plan_phase2_eyebrow: 'PHASE 2', plan_phase2_title: 'Reintroduction',
    plan_phase2_body: 'One food at a time, we add things back and watch how your body responds — uncovering your real triggers while safely widening your diet.',
    plan_reintro_locked: 'Unlocks after elimination',
    plan_start_reintro: 'Start Reintroduction Phase',
    plan_status_current: 'CURRENT', plan_status_completed: 'COMPLETED', plan_status_upcoming: 'UPCOMING',
    plan_what_now: 'WHAT TO DO NOW',
    plan_categories: 'Categories ({n}/6 complete)',
    plan_tolerated: 'Tolerated', plan_trigger: 'Trigger identified',
    plan_in_progress: 'In progress', plan_premium_tap: 'Premium — tap to unlock',
    plan_tap_start: 'Tap to start', plan_locked_until: 'Locked until ready',
    plan_continue_reintro_title: '🌱 Continue your reintroduction',
    plan_continue_reintro_body: 'You have completed your first food challenge. Premium unlocks the remaining five — the part that builds your full personal safe-food list.',
    plan_disclaimer: 'This plan is general guidance, not medical advice. The low-FODMAP diet is best done with an IBS diagnosis and a FODMAP-trained dietitian. Stop and seek care if symptoms are severe.',

    // Active test card
    test_active_badge: 'ACTIVE TEST - DAY {day} OF 3',
    test_portion: "Today's portion: {portion}",
    test_no_reaction: 'No reaction', test_reacted: 'Reacted',
    test_day_logged_next: 'Day {day} logged. Come back tomorrow for the {portion} portion.',
    test_day_logged_done: 'Day {day} logged. Test complete!',
    test_cancel: 'Cancel test',
    test_modal_title: 'Test {name}',
    test_protocol_badge: '3-day Monash protocol',
    test_protocol_body: 'Day 1: small portion — Day 2: medium — Day 3: large\nIf you react on any day, the test stops early. After 3 days, rest for {rest} days before the next category.',
    test_pick_food: 'Pick a test food',
    test_day_portions: 'Day 1: {s} — Day 2: {m} — Day 3: {l}',
    test_start_btn: 'Start 3-day test',
    test_badge: 'REINTRO TEST',
    test_count_q: 'Count this as today\'s test?',
    test_logged_q: 'You logged {food} which is part of your {cat} reintroduction. Did you have any reaction?',
    test_how_bad: 'How bad? ({n}/5)',
    test_save_btn: 'Save test result',
    test_skip_link: 'Skip — not part of test',

    // Toast messages
    toast_elim_started: 'Elimination phase started',
    toast_reintro_started: 'Reintroduction phase started',
    toast_updated: 'Entry updated',
    toast_deleted: 'Entry deleted',
    toast_test_cancelled: 'Test cancelled',
    toast_test_started: 'Test started',
    toast_test_tolerated: 'Test complete — tolerated!',
    toast_test_complete: 'Test complete',
    toast_day_logged: 'Day {n} logged',
    toast_product_logged: '{name} logged',
    toast_ai_logged: 'AI scan logged',
    toast_welcome_premium: 'Welcome to Premium — your full journey is unlocked',
    toast_diagnosed: 'Thanks — that helps us tailor your plan',
    toast_period_started: 'Period started',
    toast_period_ended: 'Period ended',

    // Edit entry modal
    edit_title: 'Edit entry',
    edit_foods_label: 'Foods (read-only)',
    edit_portion: 'Portion',
    edit_portion_s: 'Small', edit_portion_m: 'Medium', edit_portion_l: 'Large',
    portion_or_less: 'or less', portion_or_more: 'or more',
    unit_piece_one: 'piece', unit_piece_other: 'pieces', unit_slice_one: 'slice', unit_slice_other: 'slices',
    meal_portion_hint: 'Set the portion for each ingredient. Sizes are tailored to each food, with M as a typical serving.',
    meal_dish_contains: 'Contains',
    edit_hours_label: 'Hours: {n}h',
    edit_intensity_label: 'Intensity ({n}/5)',
    edit_stress_label: 'Stress level: {n}/5',
    edit_save_btn: 'Save changes',
    edit_log_again: 'Log this again now',
    edit_log_again_hint: 'Adds these foods as a new entry, timed now — this one stays unchanged',
    edit_delete_btn: 'Delete entry',

    // Barcode modal
    barcode_title: 'Scan barcode',
    barcode_point: 'Point at a barcode',
    barcode_cam_needed: 'Camera permission needed',
    barcode_allow: 'Allow',
    barcode_looking: 'Looking up',
    barcode_found: 'FOUND',
    barcode_risk: 'FODMAP RISK',
    barcode_high: 'High risk', barcode_low: 'Likely safe',
    barcode_ingredients: 'INGREDIENTS',
    barcode_scan_another: 'Scan another',
    barcode_add: 'Add to log',

    // RiskPill labels
    risk_low: 'Low', risk_moderate: 'Moderate', risk_high: 'High',
    list_fermented: 'FERMENTED', list_tolerated: 'tolerated', list_trigger: 'trigger',
    hist_high: 'HIGH', hist_mod: 'MOD', hist_liberator: 'LIBERATOR',
    pill_day: 'Day {n}', detail_ferm_tag: 'FERMENTATION', app_tagline: 'Your gut, in good hands',

    // Form labels (Flora evolution stages)
    form_seedling: 'Seedling', form_sprout: 'Sprout', form_growing: 'Growing',
    form_blooming: 'Blooming', form_thriving: 'Thriving',

    // Meal modal
    meal_modal_title: 'Log a meal',
    meal_discard_title: 'Discard this meal?',
    meal_discard_body: 'This meal has not been saved yet — your selected items will be lost.',
    meal_discard_keep: 'Keep editing',
    meal_discard_confirm: 'Discard',
    meal_modal_search_ph: 'Search any food',
    meal_modal_scan_btn: 'Scan barcode',
    barcode_intro_title: 'Scan a barcode',
    barcode_intro_body: 'Point your camera at a packaged product’s barcode and GutBloom looks it up — showing its likely FODMAP risk and flagging trigger ingredients, so you can decide before you eat.',
    barcode_intro_cta: 'Scan now',
    barcode_intro_later: 'Maybe later',
    meal_modal_your_meal: 'Your meal',
    meal_edit_portion_of: 'Edit portion: {food}', meal_remove_item: 'Remove from meal', meal_dish_remove_hint: 'Tap an ingredient to leave it out', meal_dish_add_hint: 'Had it with extras (a sauce, dip or side)? Add them from the search on the meal screen.', meal_ingredient_removed: 'removed',
    meal_base_hint: 'This is a base — add the other ingredients you used (cheese, veg, toppings…) so the score matches your plate.',
    meal_modal_hist_alert: 'Histamine alert',
    meal_modal_high_hist: 'High histamine: {foods}.',
    meal_modal_hist_lib: 'Histamine liberators: {foods}.',
    meal_modal_hist_note: 'This meal may be low-FODMAP but still problematic for you.',
    meal_modal_results: 'Results',
    meal_modal_recent: 'Recent foods',
    meal_modal_recent_meals: 'Recent meals',
    meal_type_label: 'Type', meal_type_breakfast: 'Breakfast', meal_type_lunch: 'Lunch', meal_type_dinner: 'Dinner', meal_type_snack: 'Snack',
    meal_my_breakfast: 'My Breakfast', meal_my_lunch: 'My Lunch', meal_my_dinner: 'My Dinner', meal_my_snack: 'My Snack',
    edit_dish: 'Dish', meal_edit_extras: 'Added ingredients', meal_edit_foods: 'Foods', meal_edit_add: 'Add a food', meal_edit_none: 'No foods — add at least one.', edit_now_custom: 'You changed the ingredients, so this is now a custom meal.',
    meal_custom_q: 'Can\'t find "{name}"?',
    meal_custom_tip: 'Tip: if it\'s a mix (like spaghetti bolognese), add the single ingredients instead — you\'ll get more accurate verdicts.',
    meal_custom_add: 'Choose its FODMAP level:',
    meal_custom_low_desc: 'rice, meat, eggs, carrots, potatoes, cheddar, strawberries',
    meal_custom_mod_desc: 'oats, pasta, cow\'s milk, mushrooms, chickpeas',
    meal_custom_high_desc: 'garlic, onion, wheat, beans, honey, stone fruit',
    meal_modal_pick: 'Pick foods to log your meal',
    meal_modal_items_one: '{n} item', meal_modal_items: '{n} items',
    meal_low: 'Low FODMAP', meal_moderate: 'Moderate', meal_high: 'High FODMAP',
    meal_reason_from: 'from {food}', meal_reason_stack: 'moderate FODMAPs stacking up',
    meal_why_label: 'Why',
    meal_swap_tip: 'Swap {food} → {alt}',
  },
  de: {
    // Account / authentication
    account: 'Konto', account_sub: 'Melde dich an, um deine Reise geräteübergreifend zu sichern und zu synchronisieren.',
    account_signed_in: 'Angemeldet', account_manage: 'Konto verwalten',
    sign_in: 'Anmelden', sign_up: 'Konto erstellen', sign_out: 'Abmelden',
    auth_title_login: 'Willkommen zurück', auth_title_signup: 'Konto erstellen', auth_title_reset: 'Passwort zurücksetzen',
    auth_sub_login: 'Melde dich an, um deine Darm-Reise geräteübergreifend zu synchronisieren.',
    auth_sub_signup: 'Deine Daten bleiben deine — ein Konto sichert und synchronisiert sie.',
    auth_sub_reset: 'Gib deine E-Mail ein und wir senden dir einen Link zum Zurücksetzen.',
    auth_email: 'E-Mail', auth_email_ph: 'du@beispiel.de',
    auth_password: 'Passwort', auth_password_ph: 'Mindestens 6 Zeichen',
    auth_forgot: 'Passwort vergessen?',
    auth_to_signup: 'Neu hier? Konto erstellen', auth_to_login: 'Schon ein Konto? Anmelden',
    auth_send_reset: 'Link senden', auth_back_to_login: 'Zurück zur Anmeldung',
    auth_err_empty: 'Bitte gib E-Mail und Passwort ein.',
    auth_err_email: 'Bitte gib eine gültige E-Mail-Adresse ein.',
    auth_err_password_short: 'Das Passwort muss mindestens 6 Zeichen haben.',
    auth_err_generic: 'Etwas ist schiefgelaufen. Bitte versuche es erneut.',
    auth_err_credentials: 'Falsche E-Mail oder falsches Passwort.',
    auth_err_exists: 'Diese E-Mail ist bereits registriert — bitte melde dich an.',
    auth_err_send: 'Die Bestätigungs-E-Mail konnte nicht gesendet werden. Prüfe die Adresse oder versuche es gleich erneut.',
    auth_err_unconfirmed: 'Bitte bestätige zuerst deine E-Mail — sieh in deinem Posteingang nach.',
    auth_err_mismatch: 'Die Passwörter stimmen nicht überein.',
    auth_confirm_password: 'Passwort bestätigen', auth_confirm_password_ph: 'Passwort erneut eingeben',
    auth_show_password: 'Passwort anzeigen', auth_hide_password: 'Passwort verbergen',
    auth_sent_title: 'Prüfe deine E-Mails', auth_sent_body: 'Wir haben einen Bestätigungslink an {email} gesendet. Öffne ihn, um dein Konto zu aktivieren, und melde dich dann an.',
    auth_reset_sent_body: 'Falls {email} ein Konto hat, ist ein Link zum Zurücksetzen unterwegs. Öffne ihn, um ein neues Passwort zu wählen.',
    account_nudge_title: 'Sichere deinen Fortschritt', account_nudge_sub: 'Erstelle ein kostenloses Konto, um dein Tagebuch und deine Kolonie zu sichern.', account_nudge_cta: 'Kostenloses Konto erstellen', account_nudge_row_sub: 'Tagebuch & Kolonie sichern',
    levelup_save_cta: 'Kolonie sichern — kostenloses Konto erstellen',
    sync_now: 'Jetzt synchronisieren', sync_syncing: 'Synchronisiere…', sync_last: 'Zuletzt synchronisiert {time}', sync_never: 'Noch nicht synchronisiert', sync_failed: 'Synchronisierung fehlgeschlagen — erneuter Versuch folgt.',
    account_sync_sub: 'Deine Einträge und eigenen Lebensmittel werden automatisch gesichert und synchronisiert.',
    auth_check_email: 'Fast geschafft! Prüfe deine E-Mails, um dein Konto zu bestätigen, und melde dich dann an.',
    auth_reset_sent: 'Falls diese E-Mail registriert ist, ist ein Link unterwegs.',
    auth_signed_out: 'Abgemeldet.', auth_welcome_toast: 'Angemeldet. Willkommen zurück! 🌱',
    auth_linked_note: 'Deine bestehenden Daten sind jetzt mit deinem Konto verknüpft.',
    sync_now: 'Jetzt synchronisieren', sync_syncing: 'Synchronisiere…', sync_last: 'Zuletzt synchronisiert {time}', sync_never: 'Noch nicht synchronisiert', sync_failed: 'Synchronisierung fehlgeschlagen — erneuter Versuch folgt.',
    account_sync_sub: 'Deine Einträge und eigenen Lebensmittel werden automatisch gesichert und synchronisiert.',
    continue: 'Weiter', back: 'Zurück', save: 'Speichern', close: 'Schließen', gotIt: 'Verstanden', a11y_clear: 'Suche löschen', a11y_remove: 'Entfernen', a11y_add_log: 'Eintrag hinzufügen',
    cancel: 'Abbrechen', done: 'Fertig', skip: 'Überspringen',
    tab_home: 'Heute', tab_foods: 'Lebensmittel', tab_plan: 'Mein Plan', tab_guide: 'GutGuide',
    onb_name_q: 'Wie heißt du?', onb_name_sub: 'Dein Vorname genügt.', onb_name_ph: 'Dein Name',
    onb_safety_q: 'Bevor wir beginnen', onb_safety_sub: 'Ein kurzer Gesundheits-Check — das ist wichtig.',
    onb_start: 'GutBloom starten',
    home_greeting: 'Hallo',
    home_patterns: 'Meine Muster', home_todays_meals: 'Mahlzeiten heute',
    foods_title: 'Lebensmittel', foods_sub: 'Suche Lebensmittel, sieh Auslöser und sichere Portionen',
    foods_search: 'Lebensmittel suchen', foods_count: '{n} Lebensmittel',
    foods_no_results: 'Keine Lebensmittel passen zu diesen Filtern.', foods_clear_filters: 'Filter zurücksetzen',
    filter_all: 'Alle', filter_dishes: 'Gerichte', filter_high: 'Hoch', filter_mod: 'Mittel', filter_low: 'Niedrig',
    filter_category: 'Kategorie', cat_modal_title: 'Nach Kategorie filtern', cat_modal_clear: 'Zurücksetzen', cat_modal_done: '{n} Lebensmittel anzeigen',
    grp_fruit: 'Obst', grp_veg: 'Gemüse', grp_dairy: 'Milchprodukte', grp_protein: 'Protein', grp_grain: 'Getreide', grp_drink: 'Getränke', grp_nut: 'Nüsse & Samen', grp_sauce: 'Saucen', grp_sweet: 'Süßes', grp_legume: 'Hülsenfrüchte',
    plan_title: 'Mein Plan',
    guide_title: 'GutGuide', guide_sub: '50 ehrliche Antworten auf häufige FODMAP-Fragen',
    guide_search: 'Fragen durchsuchen',
    log_meal: 'Mahlzeit erfassen', log_symptom: 'Symptom erfassen', log_sleep: 'Schlaf erfassen', log_stress: 'Stress erfassen',
    log_water: 'Wasser erfassen', log_water_sub: 'Verfolge deine Flüssigkeitszufuhr', water_title: 'Wasser', water_amount_label: 'Wie viele Gläser hast du getrunken?', water_glasses_one: '{n} Glas', water_glasses: '{n} Gläser', water_unit_hint: '1 Glas ≈ 200 ml', water_why_title: 'Warum Trinken wichtig ist', water_why: 'Ausreichend zu trinken hält die Verdauung in Bewegung und den Stuhl weich — das beugt Verstopfung und Blähungen vor, die bei RDS häufig sind, besonders wenn du mehr Ballaststoffe isst.', lf_water_title: 'Gut gemacht', lf_water_msg: 'Jedes Glas hilft deinem Darm, in Bewegung zu bleiben.', lf_water_goal_title: 'Trinkziel erreicht!', lf_water_goal_msg: 'Alle {goal} Gläser geschafft — rund {liters} L heute. Dein Darm dankt dir.', edit_water_label: 'Gläser', water_progress: '{n} / {goal} Gläser · ≈ {liters} L', water_goal_reached: 'Ziel erreicht — gut hydriert!',
    settings: 'Einstellungen', upgrade: 'Premium freischalten', premium_active: 'GutBloom Premium',
    paywall_cta: 'Premium holen', plan_annual: 'Jährlich', plan_monthly: 'Monatlich',
    save_meal: 'Mahlzeit speichern', doctor_summary: 'Arzt-Zusammenfassung',
    lang_label: 'Sprache', lang_auto: 'Automatisch (Sprache des Telefons)',
    foods_src_note: 'Die Lebensmittel-Hinweise beruhen auf etablierten Low-FODMAP-Prinzipien und dienen als allgemeine Orientierung, nicht als laborgetestete Werte. Die FODMAP-App der Monash University ist die klinische Referenz für genaue Schwellenwerte.',
    detail_trigger_head: 'Wie oft es Beschwerden auslöst', detail_portion_head: 'Portions-Hinweise',
    detail_swap_head: 'Iss stattdessen das', detail_why_head: 'Warum es Beschwerden auslöst',
    detail_swap_sub: 'Du musst nicht auf Geschmack verzichten — diese Low-FODMAP-Alternativen erfüllen denselben Zweck.',
    detail_lighten_head: 'So wird es FODMAP-arm', detail_lighten_sub: 'Kleine Änderungen senken die FODMAP-Last — gleicher Geschmack, sanfter zum Darm.',
    detail_tolerate: 'DU VERTRÄGST DAS', detail_trigger: 'DAS LÖST BESCHWERDEN AUS',
    detail_cross_warn: 'Kreuzintoleranz-Warnung',
    detail_hist_high: 'Hoher Histamingehalt — wahrscheinlich problematisch, wenn du auf gereifte oder fermentierte Lebensmittel reagierst.',
    fermented_tolerance_note: 'Fermentiert — oft besser verträglich als normale Milchprodukte',
    small_portion_note: 'In kleiner Portion in Ordnung (ca. 40 g)',
    food_base_note: 'Basis-Rezept — eigene Zutaten ergänzen',
    detail_hist_mod: 'Moderater Histamingehalt — normalerweise in kleinen Mengen gut verträglich.',
    detail_hist_lib: 'Histaminliberator — enthält kein Histamin, kann aber dazu führen, dass dein Körper es freisetzt.',
    detail_profile_note: 'Basierend auf deinem Profil. In den Einstellungen anpassen.',
    detail_portion_safe: 'In jeder Menge sicher',
    detail_portion_low_then: 'Low bis {g}g, dann moderat',
    detail_portion_low: 'Bis {g}g — Low FODMAP',
    detail_portion_mod: '{lo}–{hi}g — Moderat',
    detail_portion_high_label: 'Über {g}g — Hoch',
    detail_portion_high_note: 'High FODMAP in jeder Menge. Während der Elimination meiden.',
    detail_ferm_good: 'GUT ZU WISSEN', detail_ferm_caution: 'VORSICHT', detail_ferm_mixed: 'GEMISCHTES BILD',
    detail_trigger_note: 'Ein allgemeiner Richtwert für Menschen mit IBS. Deine eigene Verträglichkeit ist entscheidend — die Wiedereinführungsphase zeigt dir, was für dich gilt.',
    band_common: 'Häufig ein Auslöser', band_sometimes: 'Manchmal ein Auslöser', band_rarely: 'Selten ein Auslöser',
    band_common_s: 'Häufig', band_sometimes_s: 'Manchmal', band_rarely_s: 'Selten',
    recipes_title: 'Rezepte',
    recipes_flora_sub: 'Darmfreundliche Mahlzeiten, die Flora gerne kocht',
    recipes_upsell_headline: 'Ohne Grenzen kochen',
    recipes_upsell_sub: 'Du hast {free} von {total} Rezepten probiert — hier ist alles weitere.',
    recipes_upsell_bullet1: 'Alle {n} darmfreundlichen Rezepte',
    recipes_upsell_bullet2: 'Vollständiger schrittweiser Wiedereinführungsplan',
    recipes_upsell_bullet3: 'Arzt-tauglicher Datenexport',
    recipes_unlock_btn: 'Premium freischalten',
    recipe_premium_locked: 'Premium-Rezept — zum Freischalten antippen',
    recipe_meta: '{meal} · {min} Min. · {ing} Zutaten',
    recipe_badge_safe: 'ELIMINATIONS-SICHER',
    recipe_ingredients: 'Zutaten',
    recipe_steps: 'Schritte',
    recipe_log_btn: 'Als Mahlzeit erfassen',
    meal_breakfast: 'Frühstück', meal_lunch: 'Mittagessen', meal_dinner: 'Abendessen', meal_snack: 'Snack',
    guide_count: '{n} Fragen', guide_no_results: 'Keine Fragen passen zur Suche. Versuch ein anderes Wort oder Thema.',
    guide_flora_title: 'Neugierig auf FODMAP?',
    guide_flora_sub: 'Flora hat ehrliche, verständliche Antworten auf die häufigsten Fragen.',
    scan_limit_title: 'Monats-Scans aufgebraucht',
    scan_limit_body: 'Du hast alle {n} KI-Scans dieses Monats verbraucht. Dein Kontingent wird Anfang nächsten Monats zurückgesetzt. Du kannst Mahlzeiten weiterhin per Suche oder Barcode erfassen — beide unbegrenzt.',
    paywall_includes: 'Das ist in Premium enthalten',
    pattern_watch: 'Beobachten', pattern_noticed: 'Bemerkt', pattern_good: 'Gutes Zeichen',
    patterns_empty: 'Erfasse weiter Mahlzeiten und dein Befinden. Muster zeigen sich meist nach etwa einer Woche.',
    export_share: 'Zusammenfassung teilen',
    export_share_again: 'Erneut teilen',
    export_modal_title: 'Arzt-Zusammenfassung',
    export_appt_title: 'Eine Zusammenfassung für deinen Termin',
    export_appt_body: 'Dies kompiliert deine erfassten Daten, Wiedereinführungsergebnisse und beobachteten Muster in eine Zusammenfassung, die du an deinen Arzt oder Ernährungsberater senden kannst. Tippe auf Teilen, um sie per E-Mail, Messenger oder als Notiz zu speichern.',
    export_preview_label: 'Vorschau',
    export_shared: 'Geteilt!',
    export_shared_note: 'Zusammenfassung geteilt. Du kannst sie jederzeit erneut senden.',
    export_disclaimer: 'Dies spiegelt selbstberichtete Daten wider und ergänzt — ersetzt nicht — professionelle ärztliche Beurteilung.',
    recipe_how_to: 'Zubereitung',
    recipe_log_full_btn: 'Ich habe das gekocht · Als Mahlzeit erfassen',
    recipe_portions_note: 'Portionen sind Richtwerte. Überprüfe im Lebensmittel-Explorer die sicheren Mengen für moderat FODMAP-haltige Zutaten.',
    settings_premium_sub: 'Volle Wiedereinführung, alle Rezepte, Arzt-Export. Keine Werbung, nie.',

    safety_ibs_q: 'Wurde bei dir IBS von einem Arzt diagnostiziert?',
    safety_yes: 'Ja', safety_no: 'Nein', safety_unsure: 'Nicht sicher',
    safety_no_diag_note: 'Die Low-FODMAP-Diät ist ein Werkzeug nach einer IBS-Diagnose. Dieselben Symptome können auch andere Ursachen haben, die eine andere Behandlung erfordern — am besten zuerst zum Arzt. Du kannst GutBloom aber schon erkunden.',
    safety_flags_q: 'Hast du eines dieser Symptome?',
    safety_flags_sub: 'Hake alles an, was zutrifft. Lass es leer, wenn nichts zutrifft.',
    safety_flag_blood: 'Blut im Stuhl',
    safety_flag_weightloss: 'Unerklärter Gewichtsverlust',
    safety_flag_newover50: 'Neue Bauchbeschwerden nach dem 50. Lebensjahr',
    safety_flag_famhistory: 'Familiäre Vorbelastung mit Darmkrebs, Zöliakie oder CED',
    safety_flag_anemia: 'Anämie oder niedriger Eisenwert',
    safety_flag_fever: 'Fieber zusammen mit Bauchbeschwerden',
    safety_flag_nightwake: 'Symptome, die dich aus dem Schlaf reißen',
    safety_warn_title: 'Bitte geh zuerst zum Arzt, bevor du deine Ernährung änderst',
    safety_warn_body: 'Einige der Symptome, die du angekreuzt hast, nennen Ärzte „rote Flaggen". Das bedeutet nicht, dass etwas Schlimmes vorliegt — aber du solltest abgeklärt werden, bevor du eine restriktive Diät beginnst, da Ernährungsänderungen manchmal etwas verdecken können, das Aufmerksamkeit braucht.',
    safety_warn_ack: 'Ich verstehe das und möchte trotzdem fortfahren.',
    onb_step: 'Schritt {n} von {total}',
    onb_flora_intro: 'Hallo, ich bin Flora — deine Darm-Begleiterin',
    onb_ibs_q: 'Was ist IBS?',
    onb_ibs_card1_title: 'Eine sehr häufige Erkrankung',
    onb_ibs_card1_body: 'Das Reizdarmsyndrom (IBS) betrifft weltweit etwa 1 von 10 Menschen. Es ist keine Krankheit im eigentlichen Sinne — es ist eine funktionelle Darmstörung: Der Darm ist empfindlich und reaktiv, aber nicht beschädigt.',
    onb_ibs_card2_title: 'Die Symptome',
    onb_ibs_card2_body: 'Blähungen, Krämpfe, Bauchschmerzen, Durchfall, Verstopfung — oder ein Mix, der von Tag zu Tag wechselt. Die Symptome sind real und können den Alltag stark beeinträchtigen, auch wenn Tests oft unauffällig bleiben.',
    onb_ibs_card3_title: 'Die gute Nachricht',
    onb_ibs_card3_body: 'IBS ist beherrschbar. Ernährung, Stress, Schlaf und das Kennen der eigenen Auslöser machen einen echten Unterschied. Genau dabei hilft dir GutBloom.',
    onb_menstruate_q: 'Menstruierst du?',
    onb_menstruate_sub: 'Hormonschwankungen können IBS-Symptome um 30–40 % verstärken. Wenn ja, helfen wir dir, zyklusbedingte Muster zu erkennen. Du kannst das jederzeit in den Einstellungen ändern.',
    onb_menstruate_yes: 'Ja', onb_menstruate_no: 'Nein',
    onb_fodmap_q: 'Was ist FODMAP?',
    onb_fodmap_card1_title: 'Eine Gruppe fermentierbarer Zucker',
    onb_fodmap_card1_body: 'FODMAP steht für Fermentierbare Oligosaccharide, Disaccharide, Monosaccharide und Polyole — eine Familie kurzkettiger Kohlenhydrate in vielen alltäglichen Lebensmitteln. Im empfindlichen Darm werden sie schlecht aufgenommen und von Bakterien vergoren, was Gas, Blähungen und Schmerzen verursacht.',
    onb_fodmap_card2_title: 'Die Low-FODMAP-Diät',
    onb_fodmap_card2_body: 'Entwickelt von der Monash University — die am besten belegte Ernährungstherapie bei IBS. Du streichst vorübergehend High-FODMAP-Lebensmittel, um deinen Darm zu beruhigen, und führst sie dann systematisch wieder ein, um deine persönlichen Auslöser zu finden.',
    onb_fodmap_card3_title: 'Zwei Phasen, ein Ziel',
    onb_fodmap_card3_body: 'Phase 1 — Elimination (~4–6 Wochen): Auslöser streichen, Darm beruhigen. Phase 2 — Wiedereinführung (~8 Wochen): Jede FODMAP-Gruppe testen, um herauszufinden, welche Lebensmittel dir wirklich Probleme bereiten. Die meisten enden mit einer überraschend vielfältigen Ernährung.',
    onb_phase_q: 'Wo stehst du mit FODMAP?',
    onb_phase_sub: 'Wir begleiten dich von wo auch immer du gerade bist.',
    onb_phase_learning: 'Ich lerne gerade darüber', onb_phase_curious: 'Ich überlege, es auszuprobieren',
    onb_phase_elimination: 'Ich bin in der Eliminationsphase', onb_phase_reintro: 'Bereit zur Wiedereinführung',
    onb_phase_maintenance: 'Formale Phasen abgeschlossen',
    onb_symptom_q: 'Hauptsymptom?', onb_symptom_sub: 'Tippe, was am ehesten auf dich zutrifft.',
    onb_symptom_bloat: 'Blähungen nach dem Essen', onb_symptom_pain: 'Bauchschmerzen oder Krämpfe',
    onb_symptom_bowel: 'Durchfall oder Verstopfung', onb_symptom_multi: 'Mehrere Symptome',
    onb_known_q: 'Bekannte Unverträglichkeiten?', onb_known_sub: 'Alles antippen, was zutrifft. Überspringen, wenn unsicher.',
    onb_known_lactose: 'Laktose', onb_known_gluten: 'Gluten / Zöliakie',
    onb_known_fructose: 'Fruktose', onb_known_histamine: 'Histamin', onb_known_unknown: 'Noch nicht bekannt',
    onb_sleep_q: 'Wie schläfst du?', onb_sleep_sub: 'Schlaf beeinflusst Darmbeschwerden mehr als die meisten ahnen.',
    onb_sleep_great: '7–9 Stunden, ausgeruht', onb_sleep_okay: '6–7 Stunden, meistens okay', onb_sleep_poor: 'Weniger als 6 Std. oder unruhig',
    onb_stress_q: 'Stressniveau?', onb_stress_sub: 'Stress und Darm hängen eng zusammen.',
    onb_stress_low: 'Meist entspannt', onb_stress_mid: 'Handhabbarer Stress', onb_stress_high: 'Viel Stress',
    home_empty_title: 'Lass uns deinen Darm pflegen',
    home_empty_body: 'Erfasse Mahlzeiten und wie du dich fühlst, erkenne Muster und lerne, was deinem Darm gut tut — Schritt für Schritt, mit Flora an deiner Seite.',
    home_before_start: 'BEVOR DU ANFÄNGST',
    home_gp_title: 'Geh zu deinem Hausarzt oder Gastroenterologen',
    home_gp_sub: 'FODMAP ist ein Werkzeug nach einer IBS-Diagnose. Tippe, um zu sehen, wie sie helfen.',
    home_gp_confirm: 'IBS bestätigen — und andere Ursachen ausschließen',
    home_gp_confirm_body: 'Ähnliche Symptome können auch durch Zöliakie oder chronisch-entzündliche Darmerkrankungen entstehen. Dein Hausarzt kann erste Tests durchführen und dich bei Bedarf an einen Spezialisten überweisen.',
    home_diagnosed: 'Ich war beim Arzt und habe eine Diagnose',
    home_how_it_works: 'SO FUNKTIONIERT ES',
    home_how_intro: 'RDS-Beschwerden werden oft durch bestimmte Lebensmittel ausgelöst – doch die Auslöser sind bei jedem anders. GutBloom führt dich durch eine bewährte Methode in zwei Phasen, um deine zu finden.',
    home_step1_title: 'Mahlzeiten & Befinden erfassen', home_step1_sub: 'Schnellsuche, Barcode oder KI-Scan',
    home_step2_title: 'Eliminationsphase', home_step2_sub: '4–6 Wochen lang isst du einfache, magenfreundliche Lebensmittel, die selten Probleme machen. Das beruhigt deinen Darm und schafft eine klare, beschwerdefreie Ausgangsbasis.',
    home_step3_title: 'Wiedereinführungsphase', home_step3_sub: 'Du fügst Lebensmittel einzeln wieder hinzu und beobachtest, wie dein Körper reagiert – so erkennst du, welche wirklich deine Auslöser sind und welche sicher.',
    home_step4_title: 'Entspannt essen', home_step4_sub: 'Erstelle deine persönliche Liste sicherer Lebensmittel und bekannter Auslöser, damit du Mahlzeiten mit weniger Beschwerden genießen kannst.',
    home_how_note: 'Basierend auf der Low-FODMAP-Methode bei RDS. GutBloom unterstützt dich, ersetzt aber keine medizinische Beratung – sprich mit deiner Ärztin oder Ernährungsberatung.',
    home_how_more: 'Mehr lesen', home_how_less: 'Weniger anzeigen',
    home_start_elim: 'Eliminationsphase starten',
    home_lets_start: "Los geht's",
    home_today: 'Heute', home_yesterday: 'Gestern', home_journal: 'Journal', history_title: 'Verlauf', see_history: 'Alle Einträge ansehen', home_see_progress: 'Mein Fortschritt', patterns_see_all: 'Alle Muster ansehen',
    home_hi_name: 'Hallo {name}', home_hi: 'Hallo', home_journey_day: 'Tag {n} deiner Darmreise', home_eat_well: 'Iss heute gut', picker_select_day: 'Wähle einen Tag', meal_select_type: 'Wähle eine Art', progress_level_points: 'Level {level} · {points} Punkte', a11y_take_photo: 'Foto aufnehmen', a11y_week_number: 'Wochennummer', a11y_week_decrease: 'Woche verringern', a11y_week_increase: 'Woche erhöhen', week_number_ph: 'z. B. 2',
    recipes_all: 'Alle Rezepte', home_meals_sub: '4 eliminationssichere Mahlzeiten für dich ausgewählt. Tippe auf eine, um sie zu sehen.', patterns_empty_early: 'Erfasse weiter Mahlzeiten und dein Befinden. Muster zeigen sich meist nach etwa einer Woche Daten.', patterns_empty_none: 'Noch keine klaren Muster. Erfasse weiter – je konsistenter deine Einträge, desto klarer die Erkenntnisse.', patterns_sub: 'Korrelationen aus deinem Protokoll – keine Diagnosen. Nutze sie, um zu entscheiden, was du testest.', patterns_window: 'Letzte {n} Tage', sev_watch: 'IM BLICK BEHALTEN', sev_maybe: 'FRÜHES ZEICHEN', sev_info: 'BEMERKT', sev_good: 'GUTES ZEICHEN', show_less: 'Weniger anzeigen', show_more: '{n} weitere anzeigen',
    colony_lv: 'Lv {n} · {form}', colony_pts: '{n} Punkte', colony_form_spore: 'Spore', colony_form_sprout: 'Spross', colony_form_grown: 'Gewachsen', colony_form_thriving: 'Blühend', colony_level_form: 'Level {n} · {form}',
    home_low_fodmap: 'Low-FODMAP', home_symptoms: 'Symptome', home_sleep: 'Schlaf',
    home_colony_title: 'Floras Kolonie', home_see_colony: 'Kolonie ansehen',
    home_colony_complete: 'Vollständig',
    home_colony_thriving: 'Kolonie vollständig — weiter so!',
    home_days_thriving: '{n} {unit} im Aufblühen',
    home_day: 'Tag', home_days: 'Tage',
    home_to_level: 'bis Level {n}',
    period_turn_on: 'Aktivieren, wenn deine Periode beginnt',
    period_turn_off: 'Deaktivieren, wenn sie endet',
    period_active: 'Periode aktiv', period_tracking: 'Perioden-Tracking',
    period_body: 'Hormone können Darmbeschwerden rund um die Periode um 30–40 % verstärken. Das Tracking hilft GutBloom, Hormoneffekte von echten Lebensmittel-Auslösern zu unterscheiden.',
    timeline_entries: '{n} Einträge – zum Bearbeiten tippen',
    timeline_intensity: 'Intensität {n}/5',
    timeline_stress: 'Stressniveau {n}/5',
    timeline_meal_fallback: 'Mahlzeit',
    timeline_extra_one: '+ {n} Zutat', timeline_extra: '+ {n} Zutaten',
    phase_ready_title: 'Bereit loszulegen?',
    phase_ready_body: 'Starte die Eliminationsphase, um deine Auslöser zu finden. Dauert 4–6 Wochen.',
    phase_plan_link: 'Mein Plan',
    phase_elim_badge: 'RUHEPHASE · WOCHE {n}',
    phase_elim_headline_1: 'Du hast seit 1 Tag auf dich geachtet',
    phase_elim_headline_n: 'Du hast seit {n} Tagen auf dich geachtet',
    phase_elim_body_early: 'Die meisten spüren ab Woche 2–3 einen echten Unterschied. Du baust jeden Tag eine klarere Ausgangsbasis auf.',
    phase_elim_body_ready: 'Dein Körper hatte Zeit, sich zu beruhigen. Wenn du bereit bist, führen wir Lebensmittel vorsichtig wieder ein.',
    phase_reintro_badge: 'WIEDEREINFÜHRUNGSPHASE',
    phase_reintro_headline: 'Woche {n} von ~{total}',
    phase_reintro_body: 'Eine FODMAP-Gruppe nach der anderen. Dein vollständiger Plan ist im Tab „Mein Plan".',
    mood_null_title: 'Mal sehen, wie der Tag läuft',
    mood_null_sub: 'Erfasse eine Mahlzeit oder ein Symptom und Flora reagiert.',
    mood_good_title: 'Flora fühlt sich heute ruhig',
    mood_good_sub_streak: 'Kein Aufflackern seit {n} {unit}. Bleib dran.',
    mood_good_sub: 'Dein Darm hat einen guten Tag.',
    mood_soso_title: 'Ein so-lala-Tag',
    mood_soso_sub: 'Gemischte Signale heute — erfasse weiter, um die Ursache zu finden.',
    mood_bad_title: 'Flora fühlt sich nicht gut',
    mood_bad_sub: 'Ein schwerer Darmmitag. Sei gut zu dir.',
    colony_title: 'Floras Kolonie',
    colony_thriving: 'Blühende Kolonie 🎉',
    colony_points_all: '{n} Punkte · alle 12 Mikroben',
    colony_points: '{n} Punkte · {to} bis Level {next}',
    colony_earned: 'So hast du Punkte gesammelt',
    colony_row_symFree: 'Symptomfreie Tage', colony_row_symFree_how: '+20 pro ruhigen Tag',
    colony_row_meals: 'Low-FODMAP-Mahlzeiten', colony_row_meals_how: '+5 pro sicherer Mahlzeit (max. 3/Tag)',
    colony_row_logging: 'Tägliches Erfassen', colony_row_logging_how: '+10 für jeden Tag, an dem du etwas erfasst',
    colony_row_reintro: 'Abgeschlossene Tests', colony_row_reintro_how: '+50 pro abgeschlossenem Test',
    colony_footer: 'Flora wächst mit deinen Gewohnheiten. Schwierige Tage kosten keine Punkte — Beständigkeit zählt.',
    levelup_badge_complete: '🎉 KOLONIE VOLLSTÄNDIG',
    levelup_title_complete: 'Eine vollständige, blühende Kolonie!',
    levelup_body_complete: 'Du hast alle 12 Mikroben gezüchtet — eine vielfältige, gesunde Darmgemeinschaft. Jetzt halt sie am Blühen.',
    levelup_badge: 'LEVEL AUFGESTIEGEN',
    levelup_title: 'Level {n}',
    levelup_body: 'Flora ist jetzt {form}! Deine Gewohnheiten zahlen sich aus.',
    levelup_member_badge: 'NEUES KOLONIEMITGLIED',
    levelup_member_body: 'Eine neue Mikrobe ist Floras Kolonie beigetreten – deine Gewohnheiten zahlen sich aus.',
    levelup_btn: 'Super!',
    lf_meal_low_title: 'Sanfte Wahl!', lf_meal_low_msg: 'Diese Mahlzeit ist gut für deinen Darm. Flora ist begeistert.',
    lf_meal_mod_title: 'Moderate Mahlzeit', lf_meal_mod_msg: 'In kleineren Portionen okay — achte heute auf Stapeln.',
    lf_meal_high_title: 'High-FODMAP-Mahlzeit', lf_meal_high_msg: 'Diese könnte Unruhe stiften. Beobachte, wie du dich nachher fühlst.',
    lf_symptom_high_title: 'Bleib stark', lf_symptom_high_msg: 'Schade, dass du dich nicht gut fühlst. Das Erfassen hilft, die Ursache zu finden.',
    lf_symptom_low_title: 'Notiert', lf_symptom_low_msg: 'Erfasst. Hoffe, es lässt bald nach.',
    lf_sleep_great_title: 'Gut ausgeruht!', lf_sleep_great_msg: 'Guter Schlaf hilft deinem Darm, sich zu erholen. Weiter so.',
    lf_sleep_ok_title: 'Okay-Nacht', lf_sleep_ok_msg: 'Ordentlich geschlafen — etwas mehr wäre gut für deinen Darm.',
    lf_sleep_short_title: 'Kurze Nacht', lf_sleep_short_msg: 'Wenig Schlaf kann Symptome verstärken. Sei heute sanft zu dir.',
    lf_stress_low_title: 'Schön entspannt', lf_stress_low_msg: 'Wenig Stress ist super für deinen Darm. Weiter so.',
    lf_stress_mid_title: 'Handhabbarer Stress', lf_stress_mid_msg: 'Ein mittelmäßiger Tag — ein paar tiefe Atemzüge helfen.',
    lf_stress_high_title: 'Viel Stress', lf_stress_high_msg: 'Stress und Darm hängen zusammen. Versuche, ein bisschen abzuschalten.',
    lf_got_it: 'Verstanden',
    progress_title: 'Mein Fortschritt',
    progress_last7: 'LETZTE 7 TAGE',
    progress_gut_score: 'Darm-Score',
    progress_calm_days: 'Ruhige Tage',
    progress_adherence: 'Einhaltung',
    progress_avg_sleep: 'Ø Schlaf',
    progress_adherence_title: 'Low-FODMAP-Einhaltung',
    progress_adherence_sub: 'Anteil der Mahlzeiten mit sicheren Lebensmitteln',
    progress_symptoms_title: 'Symptome',
    progress_symptoms_sub: 'Weniger ist besser',
    progress_symptoms_this_week: '{n} diese Woche',
    progress_sleep_title: 'Schlaf',
    progress_sleep_sub: 'Stunden pro Nacht',
    progress_sleep_avg: 'Ø {n} Std.',
    progress_avg_water: 'Ø Wasser',
    progress_water_title: 'Wasser',
    progress_water_sub: 'Gläser pro Tag',
    progress_water_avg: 'Ø {n}',
    progress_score_null: 'Erfasse weiter, um deinen Wochen-Score zu sehen',
    progress_score_good: 'Dein Darm hatte eine ruhige, stetige Woche',
    progress_score_mid: 'Eine gemischte Woche — ein paar Dinge zu beobachten',
    progress_score_bad: 'Eine schwierige Woche — sei sanft zu dir',
    progress_flora_body: 'Flora wächst mit deinen wöchentlichen Gewohnheiten.',
    log_chooser_title: 'Was möchtest du erfassen?',
    log_meal_sub: 'Lebensmittel suchen, scannen oder KI-Erkennung',
    log_symptom_sub: 'Wie fühlst du dich?',
    log_sleep_sub: 'Stunden erfassen',
    log_stress_sub: 'Stressniveau festhalten',
    nudge_lifestyle: 'Erfasse auch Schlaf, Stress & Wasser — das schärft deine Muster.',
    sleep_title: 'Schlaf erfassen',
    sleep_hours_label: 'Geschlafene Stunden: {n} Std.',
    stress_title: 'Stress erfassen',
    stress_label: 'Stress: {label}',
    stress_calm: 'Ruhig', stress_mild: 'Leicht', stress_manageable: 'Handhabbarer',
    stress_tense: 'Angespannt', stress_overwhelmed: 'Überwältigt',
    symptom_title: 'Symptom erfassen',
    symptom_q: 'Wie fühlst du dich?',
    symptom_intensity: 'Intensität ({n}/5)',
    symptom_log_btn: 'Erfassen',
    symptom_bloating: 'Blähungen', symptom_pain: 'Schmerz', symptom_gas: 'Darmgas',
    symptom_diarrhea: 'Durchfall', symptom_constipation: 'Verstopfung', symptom_nausea: 'Übelkeit',
    paywall_headline_default: 'Dein GutBloom-Weg in vollem Umfang',
    paywall_sub_default: 'Premium gibt dir alles, was du für den vollständigen Weg von Elimination bis Wiedereinführung brauchst.',
    paywall_headline_reintro: 'Vollständige Wiedereinführung freischalten',
    paywall_sub_reintro: 'Du hast deine erste Lebensmittelprüfung abgeschlossen. Premium schaltet die verbleibenden fünf FODMAP-Gruppen frei — der Teil, der dir deine persönliche Liste sicherer Lebensmittel gibt.',
    paywall_headline_recipes: 'Alle 50+ Rezepte freischalten',
    paywall_sub_recipes: 'Du hast die kostenlosen Rezepte erkundet. Premium öffnet die komplette Bibliothek eliminationssicherer Mahlzeiten aus aller Welt.',
    paywall_headline_history: 'Deine vollständige Musterhistorie ansehen',
    paywall_sub_history: 'Kostenlos siehst du diese Woche. Premium speichert deine vollständige Geschichte, damit du Muster über Monate hinweg beobachten kannst.',
    paywall_headline_export: 'Deine Daten für deinen Arzt exportieren',
    paywall_sub_export: 'Erstelle ein übersichtliches PDF deiner Symptome, Auslöser und Fortschritte zum Teilen mit deinem Arzt oder Ernährungsberater.',
    paywall_headline_scan: 'KI-Mahlzeiterkennung ist eine Premium-Funktion',
    paywall_sub_scan: 'Fotografiere eine Mahlzeit für eine schnelle FODMAP-Einschätzung. Premium enthält 30 Scans pro Monat. Lebensmittelsuche und Barcode-Scan bleiben kostenlos.',
    paywall_feat_reintro: 'Vollständige Wiedereinführung', paywall_feat_reintro_sub: 'Alle 6 FODMAP-Gruppen testen, nicht nur die erste',
    paywall_feat_recipes: 'Alle 50+ Rezepte', paywall_feat_recipes_sub: 'Jede eliminationssichere Mahlzeit aus aller Welt',
    paywall_feat_scan: 'Deine persönliche FODMAP-Karte', paywall_feat_scan_sub: 'Sieh genau, welche Lebensmittel und Mengen dir gut tun',
    paywall_feat_history: 'Vollständige Musterhistorie', paywall_feat_history_sub: 'Trends über Monate verfolgen, nicht nur diese Woche',
    paywall_feat_export: 'Arzt-tauglicher Export', paywall_feat_export_sub: 'Ein übersichtliches PDF deiner Daten für Termine',
    paywall_free_note: 'Lebensmittelsuche, Barcode-Scan, Erfassen, GutGuide und die vollständige Eliminationsphase bleiben kostenlos — für immer. Premium schaltet die Wiedereinführung und alles, was danach kommt, frei.',
    paywall_best_badge: 'IDEAL FÜR DEN WEG',
    paywall_trial_note: '{price}. Jederzeit kündbar. Keine Werbung, nie.',
    paywall_trial_btn: 'Premium holen',
    paywall_annual_price: '69 €/Jahr · ca. 5,75 €/Monat',
    paywall_monthly_price: '8,99 €/Monat',
    annual: 'Jährlich', monthly: 'Monatlich',
    settings_title: 'Einstellungen',
    settings_premium_active_sub: 'Dein vollständiger Weg ist freigeschaltet. Danke für deine Unterstützung.',
    settings_mid_journey: 'Schon mittendrin? Aktualisiere deine Phase manuell.',
    settings_current_phase: 'Aktuelle Phase',
    settings_phase_not_started: 'Noch nicht gestartet',
    settings_phase_elimination: 'Elimination',
    settings_phase_reintroduction: 'Wiedereinführung',
    settings_week_label: 'Bereits in Woche Nr.',
    settings_week_sub: 'Wir setzen dein Startdatum entsprechend zurück.',
    settings_menstruate_q: 'Menstruierst du?',
    settings_menstruate_sub: 'Wenn ja, zeigen wir auf der Startseite einen Perioden-Tracker, um hormonbedingte Muster zu erkennen.',
    settings_other_intolerances: 'Weitere Unverträglichkeiten', settings_none: 'Keine',
    settings_other_intolerances_sub: 'Wir markieren Lebensmittel, die Low-FODMAP sind, aber bei diesen Unverträglichkeiten problematisch sein können.',
    settings_doctor_summary: 'Arzt-Zusammenfassung', settings_doctor_export_btn: 'Arzt-Zusammenfassung exportieren',
    settings_doctor_sub: 'Exportiere deine Daten als Zusammenfassung zum Teilen mit deinem Arzt oder Ernährungsberater.',
    settings_save_phase: 'Phasenänderungen speichern',
    settings_custom_foods: 'Deine eigenen Lebensmittel', settings_custom_foods_sub: 'Selbst hinzugefügte Lebensmittel. Tippe einen Punkt, um die FODMAP-Stufe zu ändern, oder ✕ zum Entfernen.',
    settings_start_over: 'Neu beginnen',
    settings_start_over_sub: 'Löscht alle deine Daten — Profil, Einträge und Fortschritt — und startet das Onboarding neu. Das lässt sich nicht rückgängig machen.',
    settings_reset_confirm: 'Ja, alles löschen',
    settings_reset_btn: 'App zurücksetzen',
    settings_disclaimer_title: 'Gesundheitshinweis',
    settings_disclaimer_body: 'GutBloom ist ein Wellness- und Tracking-Tool — kein Medizinprodukt und kein Ersatz für professionellen medizinischen Rat, Diagnose oder Behandlung. Es diagnostiziert keine Erkrankungen und ersetzt nicht deinen Arzt. Bei Fragen zu medizinischen Beschwerden wende dich immer an einen Arzt. Ignoriere oder verzögere nie professionellen Rat aufgrund von Inhalten in dieser App. Der Low-FODMAP-Weg gelingt am besten mit einer IBS-Diagnose und der Unterstützung eines FODMAP-geschulten Ernährungsberaters. Bei schweren oder beängstigenden Symptomen kontaktiere bitte einen Arzt.',
    settings_terms: 'Nutzungsbedingungen', settings_privacy: 'Datenschutzerklärung',
    plan_sub: 'Dein FODMAP-Weg in zwei Phasen',
    plan_period_pause: 'Pause in Betracht ziehen',
    plan_period_pause_sub: 'Die Periode kann Symptome um 30–40 % verstärken.',
    plan_phase1_eyebrow: 'PHASE 1', plan_phase1_title: 'Elimination',
    plan_phase1_body: 'Wir machen eine vorübergehende Pause bei häufigen Auslöser-Lebensmitteln, um deinen Darm zu beruhigen und eine klare Ausgangsbasis zu schaffen — damit Reaktionen später besser erkennbar sind.',
    plan_elim_in_progress: 'Läuft — sieh auf dem Startbildschirm, welche Lebensmittel pausiert sind',
    plan_elim_done: 'Abgeschlossen — dein Darm hatte Zeit, sich zu beruhigen',
    plan_phase2_eyebrow: 'PHASE 2', plan_phase2_title: 'Wiedereinführung',
    plan_phase2_body: 'Ein Lebensmittel nach dem anderen führen wir wieder ein und beobachten, wie dein Körper reagiert — so finden wir deine echten Auslöser und erweitern gleichzeitig sicher deine Ernährung.',
    plan_reintro_locked: 'Wird nach der Elimination freigeschaltet',
    plan_start_reintro: 'Wiedereinführungsphase starten',
    plan_status_current: 'AKTUELL', plan_status_completed: 'ABGESCHLOSSEN', plan_status_upcoming: 'AUSSTEHEND',
    plan_what_now: 'WAS JETZT TUN',
    plan_categories: 'Kategorien ({n}/6 abgeschlossen)',
    plan_tolerated: 'Vertragen', plan_trigger: 'Auslöser identifiziert',
    plan_in_progress: 'In Bearbeitung', plan_premium_tap: 'Premium — tippen zum Freischalten',
    plan_tap_start: 'Tippen zum Starten', plan_locked_until: 'Gesperrt bis bereit',
    plan_continue_reintro_title: '🌱 Wiedereinführung fortsetzen',
    plan_continue_reintro_body: 'Du hast deine erste Lebensmittelprüfung abgeschlossen. Premium schaltet die verbleibenden fünf frei — der Teil, der deine persönliche Liste sicherer Lebensmittel aufbaut.',
    plan_disclaimer: 'Dieser Plan ist eine allgemeine Orientierung, keine medizinische Beratung. Die Low-FODMAP-Diät gelingt am besten mit einer IBS-Diagnose und einem FODMAP-geschulten Ernährungsberater. Brich ab und suche Hilfe, wenn die Symptome schwer sind.',
    test_active_badge: 'AKTIVER TEST – TAG {day} VON 3',
    test_portion: 'Heutige Portion: {portion}',
    test_no_reaction: 'Keine Reaktion', test_reacted: 'Reagiert',
    test_day_logged_next: 'Tag {day} erfasst. Komm morgen für die {portion}-Portion wieder.',
    test_day_logged_done: 'Tag {day} erfasst. Test abgeschlossen!',
    test_cancel: 'Test abbrechen',
    test_modal_title: '{name} testen',
    test_protocol_badge: '3-tägiges Monash-Protokoll',
    test_protocol_body: 'Tag 1: kleine Portion — Tag 2: mittel — Tag 3: groß\nWenn du an einem Tag reagierst, endet der Test früh. Nach 3 Tagen {rest} Tage Pause vor der nächsten Kategorie.',
    test_pick_food: 'Testlebensmittel auswählen',
    test_day_portions: 'Tag 1: {s} — Tag 2: {m} — Tag 3: {l}',
    test_start_btn: '3-Tage-Test starten',
    test_badge: 'REINTRO-TEST',
    test_count_q: 'Als heutigen Test zählen?',
    test_logged_q: 'Du hast {food} erfasst, das Teil deiner {cat}-Wiedereinführung ist. Hattest du eine Reaktion?',
    test_how_bad: 'Wie stark? ({n}/5)',
    test_save_btn: 'Testergebnis speichern',
    test_skip_link: 'Überspringen — nicht Teil des Tests',
    toast_elim_started: 'Eliminationsphase gestartet',
    toast_reintro_started: 'Wiedereinführungsphase gestartet',
    toast_updated: 'Eintrag aktualisiert',
    toast_deleted: 'Eintrag gelöscht',
    toast_test_cancelled: 'Test abgebrochen',
    toast_test_started: 'Test gestartet',
    toast_test_tolerated: 'Test abgeschlossen — vertragen!',
    toast_test_complete: 'Test abgeschlossen',
    toast_day_logged: 'Tag {n} erfasst',
    toast_product_logged: '{name} erfasst',
    toast_ai_logged: 'KI-Scan erfasst',
    toast_welcome_premium: 'Willkommen bei Premium — dein vollständiger Weg ist freigeschaltet',
    toast_diagnosed: 'Danke — das hilft uns, deinen Plan anzupassen',
    toast_period_started: 'Periode gestartet',
    toast_period_ended: 'Periode beendet',
    edit_title: 'Eintrag bearbeiten',
    edit_foods_label: 'Lebensmittel (nur lesen)',
    edit_portion: 'Portion',
    edit_portion_s: 'Klein', edit_portion_m: 'Mittel', edit_portion_l: 'Groß',
    portion_or_less: 'oder weniger', portion_or_more: 'oder mehr',
    unit_piece_one: 'Stück', unit_piece_other: 'Stück', unit_slice_one: 'Scheibe', unit_slice_other: 'Scheiben',
    meal_portion_hint: 'Lege die Portion für jede Zutat fest. Die Größen sind auf jedes Lebensmittel abgestimmt, M ist eine typische Portion.',
    meal_dish_contains: 'Enthält',
    edit_hours_label: 'Stunden: {n} Std.',
    edit_intensity_label: 'Intensität ({n}/5)',
    edit_stress_label: 'Stresslevel: {n}/5',
    edit_save_btn: 'Änderungen speichern',
    edit_log_again: 'Jetzt erneut loggen',
    edit_log_again_hint: 'Fügt diese Lebensmittel als neuen Eintrag hinzu (jetzt) — dieser bleibt unverändert',
    edit_delete_btn: 'Eintrag löschen',
    barcode_title: 'Barcode scannen',
    barcode_point: 'Kamera auf Barcode richten',
    barcode_cam_needed: 'Kamerazugriff erforderlich',
    barcode_allow: 'Erlauben',
    barcode_looking: 'Wird gesucht',
    barcode_found: 'GEFUNDEN',
    barcode_risk: 'FODMAP-RISIKO',
    barcode_high: 'Hohes Risiko', barcode_low: 'Wahrscheinlich sicher',
    barcode_ingredients: 'ZUTATEN',
    barcode_scan_another: 'Weiteren scannen',
    barcode_add: 'Zum Protokoll hinzufügen',
    risk_low: 'Niedrig', risk_moderate: 'Mittel', risk_high: 'Hoch',
    list_fermented: 'FERMENTIERT', list_tolerated: 'vertragen', list_trigger: 'Auslöser',
    hist_high: 'HOCH', hist_mod: 'MITTEL', hist_liberator: 'FREISETZER',
    pill_day: 'Tag {n}', detail_ferm_tag: 'FERMENTATION', app_tagline: 'Dein Darm in guten Händen',
    form_seedling: 'Keimling', form_sprout: 'Spross', form_growing: 'Wachsend',
    form_blooming: 'Blühend', form_thriving: 'Aufblühend',

    // Meal modal
    meal_modal_title: 'Mahlzeit erfassen',
    meal_discard_title: 'Mahlzeit verwerfen?',
    meal_discard_body: 'Noch nicht gespeichert — deine ausgewählten Zutaten gehen verloren.',
    meal_discard_keep: 'Weiter bearbeiten',
    meal_discard_confirm: 'Verwerfen',
    meal_modal_search_ph: 'Lebensmittel suchen',
    meal_modal_scan_btn: 'Barcode scannen',
    barcode_intro_title: 'Barcode scannen',
    barcode_intro_body: 'Richte die Kamera auf den Barcode eines verpackten Produkts – GutBloom schlägt es nach und zeigt das wahrscheinliche FODMAP-Risiko sowie mögliche Auslöser-Zutaten, damit du vor dem Essen entscheiden kannst.',
    barcode_intro_cta: 'Jetzt scannen',
    barcode_intro_later: 'Vielleicht später',
    meal_modal_your_meal: 'Deine Mahlzeit',
    meal_edit_portion_of: 'Portion bearbeiten: {food}', meal_remove_item: 'Aus Mahlzeit entfernen', meal_dish_remove_hint: 'Tippe eine Zutat an, um sie wegzulassen', meal_dish_add_hint: 'Mit Extras gegessen (Soße, Dip oder Beilage)? Füge sie über die Suche im Mahlzeit-Screen hinzu.', meal_ingredient_removed: 'entfernt',
    meal_base_hint: 'Das ist eine Basis — füge die weiteren Zutaten hinzu, die du verwendet hast (Käse, Gemüse, Belag…), damit die Bewertung zu deinem Teller passt.',
    meal_modal_hist_alert: 'Histamin-Alarm',
    meal_modal_high_hist: 'Hohes Histamin: {foods}.',
    meal_modal_hist_lib: 'Histaminliberatoren: {foods}.',
    meal_modal_hist_note: 'Diese Mahlzeit kann Low-FODMAP sein, aber trotzdem für dich problematisch.',
    meal_modal_results: 'Ergebnisse',
    meal_modal_recent: 'Zuletzt verwendet',
    meal_modal_recent_meals: 'Letzte Mahlzeiten',
    meal_type_label: 'Art', meal_type_breakfast: 'Frühstück', meal_type_lunch: 'Mittagessen', meal_type_dinner: 'Abendessen', meal_type_snack: 'Snack',
    meal_my_breakfast: 'Mein Frühstück', meal_my_lunch: 'Mein Mittagessen', meal_my_dinner: 'Mein Abendessen', meal_my_snack: 'Mein Snack',
    edit_dish: 'Gericht', meal_edit_extras: 'Zusätzliche Zutaten', meal_edit_foods: 'Lebensmittel', meal_edit_add: 'Lebensmittel hinzufügen', meal_edit_none: 'Keine Lebensmittel — füge mindestens eins hinzu.', edit_now_custom: 'Du hast die Zutaten geändert — das ist jetzt eine eigene Mahlzeit.',
    meal_custom_q: '"{name}" nicht gefunden?',
    meal_custom_tip: 'Tipp: Wenn es eine Mischung ist (wie Käsespätzle), füge stattdessen die einzelnen Zutaten hinzu — du erhältst genauere Urteile.',
    meal_custom_add: 'FODMAP-Stufe wählen:',
    meal_custom_low_desc: 'Reis, Fleisch, Eier, Möhren, Kartoffeln, Cheddar, Erdbeeren',
    meal_custom_mod_desc: 'Hafer, Pasta, Kuhmilch, Pilze, Kichererbsen',
    meal_custom_high_desc: 'Knoblauch, Zwiebel, Weizen, Bohnen, Honig, Steinobst',
    meal_modal_pick: 'Wähle Lebensmittel für deine Mahlzeit',
    meal_modal_items_one: '{n} Lebensmittel', meal_modal_items: '{n} Lebensmittel',
    meal_low: 'Low FODMAP', meal_moderate: 'Moderat', meal_high: 'Hoch FODMAP',
    meal_reason_from: 'wegen {food}', meal_reason_stack: 'moderate FODMAPs summieren sich',
    meal_why_label: 'Warum',
    meal_swap_tip: 'Ersetze {food} → {alt}',
  },
  es: {
    // Account / authentication
    account: 'Cuenta', account_sub: 'Inicia sesión para respaldar y sincronizar tu progreso entre dispositivos.',
    account_signed_in: 'Sesión iniciada', account_manage: 'Gestionar cuenta',
    sign_in: 'Iniciar sesión', sign_up: 'Crear cuenta', sign_out: 'Cerrar sesión',
    auth_title_login: 'Bienvenido de nuevo', auth_title_signup: 'Crea tu cuenta', auth_title_reset: 'Restablecer contraseña',
    auth_sub_login: 'Inicia sesión para sincronizar tu progreso entre dispositivos.',
    auth_sub_signup: 'Tus datos son tuyos: una cuenta los respalda y los mantiene sincronizados.',
    auth_sub_reset: 'Introduce tu correo y te enviaremos un enlace para restablecerla.',
    auth_email: 'Correo', auth_email_ph: 'tu@ejemplo.com',
    auth_password: 'Contraseña', auth_password_ph: 'Al menos 6 caracteres',
    auth_forgot: '¿Olvidaste tu contraseña?',
    auth_to_signup: '¿Nuevo aquí? Crea una cuenta', auth_to_login: '¿Ya tienes cuenta? Inicia sesión',
    auth_send_reset: 'Enviar enlace', auth_back_to_login: 'Volver a iniciar sesión',
    auth_err_empty: 'Introduce tu correo y contraseña.',
    auth_err_email: 'Introduce una dirección de correo válida.',
    auth_err_password_short: 'La contraseña debe tener al menos 6 caracteres.',
    auth_err_generic: 'Algo salió mal. Inténtalo de nuevo.',
    auth_err_credentials: 'Correo o contraseña incorrectos.',
    auth_err_exists: 'Ese correo ya está registrado: inicia sesión.',
    auth_err_send: 'No pudimos enviar el correo de confirmación. Revisa la dirección o inténtalo en un momento.',
    auth_err_unconfirmed: 'Confirma primero tu correo: revisa tu bandeja de entrada.',
    auth_err_mismatch: 'Las contraseñas no coinciden.',
    auth_confirm_password: 'Confirmar contraseña', auth_confirm_password_ph: 'Vuelve a escribir tu contraseña',
    auth_show_password: 'Mostrar contraseña', auth_hide_password: 'Ocultar contraseña',
    auth_sent_title: 'Revisa tu correo', auth_sent_body: 'Enviamos un enlace de confirmación a {email}. Ábrelo para activar tu cuenta y luego inicia sesión.',
    auth_reset_sent_body: 'Si {email} tiene una cuenta, el enlace para restablecer la contraseña ya va en camino. Ábrelo para elegir una nueva contraseña.',
    account_nudge_title: 'Guarda tu progreso', account_nudge_sub: 'Crea una cuenta gratis para respaldar tu diario y tu colonia.', account_nudge_cta: 'Crear cuenta gratis', account_nudge_row_sub: 'Respalda tu diario y colonia',
    levelup_save_cta: 'Guarda tu colonia: crea una cuenta gratis',
    sync_now: 'Sincronizar ahora', sync_syncing: 'Sincronizando…', sync_last: 'Última sincronización {time}', sync_never: 'Sin sincronizar todavía', sync_failed: 'Error de sincronización — se reintentará.',
    account_sync_sub: 'Tus registros y alimentos personalizados se guardan y sincronizan automáticamente.',
    auth_check_email: '¡Casi listo! Revisa tu correo para confirmar tu cuenta y luego inicia sesión.',
    auth_reset_sent: 'Si ese correo está registrado, el enlace ya va en camino.',
    auth_signed_out: 'Sesión cerrada.', auth_welcome_toast: 'Sesión iniciada. ¡Bienvenido de nuevo! 🌱',
    auth_linked_note: 'Tus datos existentes ahora están vinculados a tu cuenta.',
    sync_now: 'Sincronizar ahora', sync_syncing: 'Sincronizando…', sync_last: 'Última sincronización {time}', sync_never: 'Sin sincronizar todavía', sync_failed: 'Error de sincronización — se reintentará.',
    account_sync_sub: 'Tus registros y alimentos personalizados se respaldan y sincronizan automáticamente.',
    continue: 'Continuar', back: 'Atrás', save: 'Guardar', close: 'Cerrar', gotIt: 'Entendido', a11y_clear: 'Borrar búsqueda', a11y_remove: 'Quitar', a11y_add_log: 'Añadir registro',
    cancel: 'Cancelar', done: 'Hecho', skip: 'Omitir',
    tab_home: 'Hoy', tab_foods: 'Alimentos', tab_plan: 'Mi plan', tab_guide: 'GutGuide',
    onb_name_q: '¿Cómo te llamas?', onb_name_sub: 'Con tu nombre basta.', onb_name_ph: 'Tu nombre',
    onb_safety_q: 'Antes de empezar', onb_safety_sub: 'Una breve comprobación de salud — esto importa.',
    onb_start: 'Empezar GutBloom',
    home_greeting: 'Hola',
    home_patterns: 'Mis patrones', home_todays_meals: 'Comidas de hoy',
    foods_title: 'Explorador de alimentos', foods_sub: 'Busca alimentos, ve desencadenantes y porciones seguras',
    foods_search: 'Buscar alimentos', foods_count: '{n} alimentos',
    foods_no_results: 'Ningún alimento coincide con estos filtros.', foods_clear_filters: 'Borrar filtros',
    filter_all: 'Todos', filter_dishes: 'Platos', filter_high: 'Alto', filter_mod: 'Moderado', filter_low: 'Bajo',
    filter_category: 'Categoría', cat_modal_title: 'Filtrar por categoría', cat_modal_clear: 'Borrar', cat_modal_done: 'Ver {n} alimentos',
    grp_fruit: 'Fruta', grp_veg: 'Verduras', grp_dairy: 'Lácteos', grp_protein: 'Proteína', grp_grain: 'Cereales', grp_drink: 'Bebidas', grp_nut: 'Frutos secos', grp_sauce: 'Salsas', grp_sweet: 'Dulces', grp_legume: 'Legumbres',
    plan_title: 'Mi plan',
    guide_title: 'GutGuide', guide_sub: '50 respuestas honestas a preguntas comunes sobre FODMAP',
    guide_search: 'Buscar preguntas',
    log_meal: 'Registrar comida', log_symptom: 'Registrar síntoma', log_sleep: 'Registrar sueño', log_stress: 'Registrar estrés',
    log_water: 'Registrar agua', log_water_sub: 'Controla tu hidratación', water_title: 'Agua', water_amount_label: '¿Cuántos vasos bebiste?', water_glasses_one: '{n} vaso', water_glasses: '{n} vasos', water_unit_hint: '1 vaso ≈ 200 ml', water_why_title: 'Por qué es importante hidratarse', water_why: 'Mantenerte hidratado ayuda a que la digestión siga su curso y las heces estén blandas — previene el estreñimiento y la hinchazón habituales en el SII, sobre todo al aumentar la fibra.', lf_water_title: 'Bien hecho', lf_water_msg: 'Cada vaso ayuda a que tu intestino siga funcionando.', lf_water_goal_title: '¡Meta de hidratación lograda!', lf_water_goal_msg: 'Los {goal} vasos completos — unos {liters} L hoy. Tu intestino te lo agradece.', edit_water_label: 'Vasos', water_progress: '{n} / {goal} vasos · ≈ {liters} L', water_goal_reached: '¡Meta alcanzada, bien hidratado!',
    settings: 'Ajustes', upgrade: 'Pasar a Premium', premium_active: 'GutBloom Premium',
    paywall_cta: 'Obtener Premium', plan_annual: 'Anual', plan_monthly: 'Mensual',
    save_meal: 'Guardar comida', doctor_summary: 'Resumen para el médico',
    lang_label: 'Idioma', lang_auto: 'Automático (idioma del teléfono)',
    foods_src_note: 'La guía de alimentos se basa en principios establecidos de la dieta baja en FODMAP como orientación general, no son valores analizados en laboratorio. La app FODMAP de la Universidad de Monash es la referencia clínica para umbrales precisos.',
    detail_trigger_head: 'Con qué frecuencia es un desencadenante', detail_portion_head: 'Guía de porciones',
    detail_swap_head: 'Come esto en su lugar', detail_why_head: 'Por qué es un desencadenante',
    detail_swap_sub: 'No tienes que renunciar al sabor — estas alternativas bajas en FODMAP cumplen la misma función.',
    detail_lighten_head: 'Cómo hacerlo bajo en FODMAP', detail_lighten_sub: 'Pequeños cambios que reducen la carga de FODMAP — mismo sabor, más suave para el intestino.',
    detail_tolerate: 'LO TOLERAS', detail_trigger: 'ESTO TE AFECTA',
    detail_cross_warn: 'Aviso de intolerancia cruzada',
    detail_hist_high: 'Alto en histamina — probablemente problemático si reaccionas a alimentos añejados o fermentados.',
    fermented_tolerance_note: 'Fermentado — a menudo mejor tolerado que los lácteos normales',
    small_portion_note: 'Bien en porción pequeña (unos 40 g)',
    food_base_note: 'Receta base — añade tus ingredientes',
    detail_hist_mod: 'Histamina moderada — generalmente tolerada en pequeñas porciones.',
    detail_hist_lib: 'Liberador de histamina — no contiene histamina pero puede hacer que tu cuerpo la libere.',
    detail_profile_note: 'Según tu perfil. Ajusta en Configuración.',
    detail_portion_safe: 'Seguro en cualquier cantidad',
    detail_portion_low_then: 'Bajo hasta {g}g, luego moderado',
    detail_portion_low: 'Hasta {g}g — Bajo en FODMAP',
    detail_portion_mod: '{lo}–{hi}g — Moderado',
    detail_portion_high_label: 'Más de {g}g — Alto',
    detail_portion_high_note: 'Alto en FODMAP en cualquier cantidad. Evitar durante la eliminación.',
    detail_ferm_good: 'BUENO SABERLO', detail_ferm_caution: 'ATENCIÓN', detail_ferm_mixed: 'PANORAMA MIXTO',
    detail_trigger_note: 'Una guía general para personas con SII. Lo que importa es tu propia tolerancia — la fase de reintroducción es cómo lo descubres.',
    band_common: 'Desencadenante frecuente', band_sometimes: 'A veces desencadenante', band_rarely: 'Rara vez desencadenante',
    band_common_s: 'Frecuente', band_sometimes_s: 'A veces', band_rarely_s: 'Rara vez',
    recipes_title: 'Recetas',
    recipes_flora_sub: 'Comidas amigables para el intestino que le encanta cocinar a Flora',
    recipes_upsell_headline: 'Cocina sin límites',
    recipes_upsell_sub: 'Has probado {free} de {total} recetas — aquí tienes todo lo demás.',
    recipes_upsell_bullet1: 'Todas las {n} recetas amigables para el intestino',
    recipes_upsell_bullet2: 'Plan completo paso a paso de reintroducción',
    recipes_upsell_bullet3: 'Exportación de datos lista para el médico',
    recipes_unlock_btn: 'Desbloquear Premium',
    recipe_premium_locked: 'Receta Premium — toca para desbloquear',
    recipe_meta: '{meal} · {min} min · {ing} ingredientes',
    recipe_badge_safe: 'SEGURA EN ELIMINACIÓN',
    recipe_ingredients: 'Ingredientes',
    recipe_steps: 'Pasos',
    recipe_log_btn: 'Registrar como comida',
    meal_breakfast: 'Desayuno', meal_lunch: 'Almuerzo', meal_dinner: 'Cena', meal_snack: 'Snack',
    guide_count: '{n} preguntas', guide_no_results: 'Ninguna pregunta coincide con la búsqueda. Prueba otra palabra o tema.',
    guide_flora_title: '¿Curiosidad sobre FODMAP?',
    guide_flora_sub: 'Flora tiene respuestas honestas y claras a las preguntas más frecuentes.',
    scan_limit_title: 'Scans mensuales agotados',
    scan_limit_body: 'Has usado todos los {n} scans de IA de este mes. Tu cuota se renueva al inicio del mes siguiente. Mientras tanto, puedes seguir registrando comidas por búsqueda o código de barras — ambas sin límite.',
    paywall_includes: 'Qué incluye Premium',
    pattern_watch: 'A vigilar', pattern_noticed: 'Observado', pattern_good: 'Buena señal',
    patterns_empty: 'Sigue registrando comidas y cómo te sientes. Los patrones suelen aparecer tras una semana de datos.',
    export_share: 'Compartir resumen',
    export_share_again: 'Compartir de nuevo',
    export_modal_title: 'Resumen para el médico',
    export_appt_title: 'Un resumen para tu cita',
    export_appt_body: 'Esto compila tus datos registrados, los resultados de reintroducción y los patrones observados en un resumen que puedes enviar a tu médico o dietista. Toca Compartir para enviarlo por correo, mensajería o guardarlo como nota.',
    export_preview_label: 'Vista previa',
    export_shared: '¡Compartido!',
    export_shared_note: 'Resumen compartido. Puedes enviarlo de nuevo cuando quieras.',
    export_disclaimer: 'Esto refleja datos autoinformados y complementa — no reemplaza — la evaluación médica profesional.',
    recipe_how_to: 'Cómo prepararlo',
    recipe_log_full_btn: 'Lo hice · Registrar como comida',
    recipe_portions_note: 'Las porciones son orientativas. Consulta el Explorador de alimentos para conocer los límites seguros de los ingredientes moderados en FODMAP.',
    settings_premium_sub: 'Reintroducción completa, todas las recetas, exportación médica. Sin anuncios, nunca.',

    safety_ibs_q: '¿Te ha diagnosticado un médico el síndrome de intestino irritable (SII)?',
    safety_yes: 'Sí', safety_no: 'No', safety_unsure: 'No estoy seguro/a',
    safety_no_diag_note: 'La dieta baja en FODMAP está diseñada como herramienta tras un diagnóstico de SII. Los mismos síntomas pueden deberse a otras afecciones que requieren un tratamiento diferente, por lo que vale la pena consultar a un médico primero. Puedes seguir explorando GutBloom para aprender.',
    safety_flags_q: '¿Tienes alguno de estos síntomas?',
    safety_flags_sub: 'Marca todo lo que aplique. Deja en blanco si ninguno.',
    safety_flag_blood: 'Sangre en las heces',
    safety_flag_weightloss: 'Pérdida de peso inexplicable',
    safety_flag_newover50: 'Síntomas digestivos nuevos que comenzaron después de los 50 años',
    safety_flag_famhistory: 'Antecedentes familiares de cáncer de colon, celiaquía o EII',
    safety_flag_anemia: 'Anemia o hierro bajo',
    safety_flag_fever: 'Fiebre junto con los síntomas digestivos',
    safety_flag_nightwake: 'Síntomas que te despiertan por la noche',
    safety_warn_title: 'Por favor, consulta a un médico antes de cambiar tu dieta',
    safety_warn_body: 'Algunos de los síntomas que has marcado son lo que los médicos llaman "señales de alerta". No significan que algo grave esté pasando, pero sí que debes ser evaluado/a antes de comenzar una dieta restrictiva, ya que los cambios alimentarios pueden enmascarar algo que necesita atención.',
    safety_warn_ack: 'Lo entiendo y he decidido continuar.',
    onb_step: 'Paso {n} de {total}',
    onb_flora_intro: 'Hola, soy Flora — tu compañera intestinal',
    onb_ibs_q: '¿Qué es el SII?',
    onb_ibs_card1_title: 'Una afección muy común',
    onb_ibs_card1_body: 'El síndrome de intestino irritable (SII) afecta a alrededor de 1 de cada 10 personas en el mundo. No es una enfermedad — es un trastorno funcional del intestino: el intestino es sensible y reactivo, pero no está dañado.',
    onb_ibs_card2_title: 'Los síntomas',
    onb_ibs_card2_body: 'Hinchazón, calambres, dolor de estómago, diarrea, estreñimiento — o una mezcla que cambia día a día. Los síntomas son reales y pueden afectar mucho la vida cotidiana, aunque los análisis suelen salir normales.',
    onb_ibs_card3_title: 'La buena noticia',
    onb_ibs_card3_body: 'El SII es manejable. La dieta, el estrés, el sueño y conocer tus desencadenantes personales marcan una diferencia real. Eso es exactamente lo que GutBloom te ayuda a hacer.',
    onb_menstruate_q: '¿Tienes menstruación?',
    onb_menstruate_sub: 'Los ciclos hormonales pueden amplificar los síntomas del SII un 30–40 %. Si es así, te ayudaremos a detectar patrones relacionados con el ciclo. Puedes cambiarlo en cualquier momento en Ajustes.',
    onb_menstruate_yes: 'Sí', onb_menstruate_no: 'No',
    onb_fodmap_q: '¿Qué es FODMAP?',
    onb_fodmap_card1_title: 'Un grupo de azúcares fermentables',
    onb_fodmap_card1_body: 'FODMAP son las siglas de Oligosacáridos, Disacáridos, Monosacáridos y Polioles Fermentables — una familia de carbohidratos de cadena corta presentes en muchos alimentos cotidianos. En intestinos sensibles, se absorben mal y son fermentados por bacterias, lo que provoca gases, hinchazón y dolor.',
    onb_fodmap_card2_title: 'La dieta baja en FODMAP',
    onb_fodmap_card2_body: 'Desarrollada por la Universidad de Monash, es el enfoque dietético más respaldado por la evidencia para el SII. Eliminas temporalmente los alimentos altos en FODMAP para calmar el intestino y luego los reintroduces de forma sistemática para encontrar tus desencadenantes personales.',
    onb_fodmap_card3_title: 'Dos fases, un objetivo',
    onb_fodmap_card3_body: 'Fase 1 — Eliminación (~4–6 semanas): eliminar los desencadenantes, calmar el intestino. Fase 2 — Reintroducción (~8 semanas): probar cada grupo FODMAP para saber exactamente qué alimentos te dan problemas. La mayoría acaba con una dieta sorprendentemente variada.',
    onb_phase_q: '¿Dónde estás con FODMAP?',
    onb_phase_sub: 'Te guiamos desde donde estés.',
    onb_phase_learning: 'Solo aprendiendo', onb_phase_curious: 'Pensando en probarlo',
    onb_phase_elimination: 'En fase de eliminación', onb_phase_reintro: 'Listo/a para reintroducir',
    onb_phase_maintenance: 'Fases formales completadas',
    onb_symptom_q: '¿Síntoma principal?', onb_symptom_sub: 'Toca lo que más te identifique.',
    onb_symptom_bloat: 'Hinchazón tras las comidas', onb_symptom_pain: 'Dolor de estómago o calambres',
    onb_symptom_bowel: 'Diarrea o estreñimiento', onb_symptom_multi: 'Múltiples síntomas',
    onb_known_q: '¿Alguna intolerancia conocida?', onb_known_sub: 'Toca todo lo que aplique. Omite si no estás seguro/a.',
    onb_known_lactose: 'Lactosa', onb_known_gluten: 'Gluten / Celiaquía',
    onb_known_fructose: 'Fructosa', onb_known_histamine: 'Histamina', onb_known_unknown: 'Aún no lo sé',
    onb_sleep_q: '¿Cómo duermes?', onb_sleep_sub: 'El sueño afecta los síntomas intestinales más de lo que la mayoría cree.',
    onb_sleep_great: '7–9 horas, bien descansado/a', onb_sleep_okay: '6–7 horas, generalmente bien', onb_sleep_poor: 'Menos de 6 h o con despertares',
    onb_stress_q: '¿Nivel de estrés?', onb_stress_sub: 'El estrés y el intestino van de la mano.',
    onb_stress_low: 'Mayormente tranquilo/a', onb_stress_mid: 'Manejable', onb_stress_high: 'Mucho estrés',
    home_empty_title: 'Cuidemos tu intestino',
    home_empty_body: 'Registra tus comidas y cómo te sientes, detecta patrones y aprende qué le gusta a tu intestino — un día a la vez, con Flora a tu lado.',
    home_before_start: 'ANTES DE EMPEZAR',
    home_gp_title: 'Visita a tu médico de cabecera o gastroenterólogo',
    home_gp_sub: 'FODMAP es una herramienta tras un diagnóstico de SII. Toca para ver cómo pueden ayudarte.',
    home_gp_confirm: 'Confirmar que es SII y descartar otras causas',
    home_gp_confirm_body: 'Síntomas como los tuyos también pueden deberse a celiaquía o enfermedad inflamatoria intestinal. Tu médico puede hacer pruebas iniciales y derivarte a un especialista si es necesario.',
    home_diagnosed: 'He ido al médico y tengo diagnóstico',
    home_how_it_works: 'CÓMO FUNCIONA',
    home_how_intro: 'Los síntomas del SII suelen desencadenarse por ciertos alimentos, pero los desencadenantes son distintos en cada persona. GutBloom te guía con un método probado en dos fases para encontrar los tuyos.',
    home_step1_title: 'Registra comidas y cómo te sientes', home_step1_sub: 'Búsqueda rápida, código de barras o escáner de IA',
    home_step2_title: 'Fase de eliminación', home_step2_sub: 'Durante 4–6 semanas comes alimentos sencillos y suaves para el intestino que rara vez causan molestias. Esto calma tu intestino y crea una base clara y sin síntomas.',
    home_step3_title: 'Fase de reintroducción', home_step3_sub: 'Vuelves a añadir alimentos de uno en uno y observas cómo reacciona tu cuerpo: así identificas cuáles son realmente tus desencadenantes y cuáles son seguros.',
    home_step4_title: 'Come con confianza', home_step4_sub: 'Crea tu lista personal de alimentos seguros y desencadenantes conocidos para disfrutar de las comidas con menos brotes.',
    home_how_note: 'Basado en el método bajo en FODMAP para el SII. GutBloom te acompaña, pero no es consejo médico: consulta con tu médico o dietista.',
    home_how_more: 'Leer más', home_how_less: 'Ver menos',
    home_start_elim: 'Iniciar fase de eliminación',
    home_lets_start: 'Empecemos',
    home_today: 'Hoy', home_yesterday: 'Ayer', home_journal: 'Diario', history_title: 'Historial', see_history: 'Ver todas las entradas', home_see_progress: 'Ver mi progreso', patterns_see_all: 'Ver todos los patrones',
    home_hi_name: 'Hola {name}', home_hi: 'Hola', home_journey_day: 'Día {n} de tu viaje intestinal', home_eat_well: 'Come bien hoy', picker_select_day: 'Elige un día', meal_select_type: 'Elige un tipo', progress_level_points: 'Nivel {level} · {points} puntos', a11y_take_photo: 'Hacer foto', a11y_week_number: 'Número de semana', a11y_week_decrease: 'Disminuir semana', a11y_week_increase: 'Aumentar semana', week_number_ph: 'p. ej. 2',
    recipes_all: 'Todas las recetas', home_meals_sub: '4 comidas seguras en eliminación elegidas para ti. Toca una para verla.', patterns_empty_early: 'Sigue registrando comidas y cómo te sientes. Los patrones suelen aparecer tras una semana de datos.', patterns_empty_none: 'Aún no hay patrones claros. Sigue registrando: cuanto más constantes sean tus entradas, más nítidas serán las conclusiones.', patterns_sub: 'Correlaciones de tu registro, no diagnósticos. Úsalas para decidir qué probar.', patterns_window: 'Últimos {n} días', sev_watch: 'A VIGILAR', sev_maybe: 'SEÑAL TEMPRANA', sev_info: 'OBSERVADO', sev_good: 'BUENA SEÑAL', show_less: 'Ver menos', show_more: 'Ver {n} más',
    colony_lv: 'Niv. {n} · {form}', colony_pts: '{n} puntos', colony_form_spore: 'Espora', colony_form_sprout: 'Brote', colony_form_grown: 'Crecida', colony_form_thriving: 'Próspera', colony_level_form: 'Nivel {n} · {form}',
    home_low_fodmap: 'Bajo en FODMAP', home_symptoms: 'Síntomas', home_sleep: 'Sueño',
    home_colony_title: 'La colonia de Flora', home_see_colony: 'Ver colonia',
    home_colony_complete: 'Completa',
    home_colony_thriving: 'Colonia completa — ¡sigue así!',
    home_days_thriving: '{n} {unit} floreciendo',
    home_day: 'día', home_days: 'días',
    home_to_level: 'para el nivel {n}',
    period_turn_on: 'Activar cuando empiece tu período',
    period_turn_off: 'Desactivar cuando termine',
    period_active: 'Período activo', period_tracking: 'Seguimiento del período',
    period_body: 'Las hormonas pueden amplificar los síntomas intestinales un 30–40 % alrededor del período. El seguimiento ayuda a GutBloom a distinguir los efectos hormonales de los desencadenantes alimentarios reales.',
    timeline_entries: '{n} entradas - toca para editar',
    timeline_intensity: 'Intensidad {n}/5',
    timeline_stress: 'Nivel de estrés {n}/5',
    timeline_meal_fallback: 'Comida',
    timeline_extra_one: '+ {n} ingrediente', timeline_extra: '+ {n} ingredientes',
    phase_ready_title: '¿Listo/a para empezar?',
    phase_ready_body: 'Inicia la fase de eliminación para identificar tus desencadenantes. Dura 4–6 semanas.',
    phase_plan_link: 'Ver mi plan',
    phase_elim_badge: 'FASE DE REINICIO · SEMANA {n}',
    phase_elim_headline_1: 'Llevas 1 día cuidándote',
    phase_elim_headline_n: 'Llevas {n} días cuidándote',
    phase_elim_body_early: 'La mayoría nota una diferencia real alrededor de la semana 2–3. Cada día construyes una línea base más clara.',
    phase_elim_body_ready: 'Tu cuerpo ha tenido tiempo de calmarse. Cuando estés listo/a, empezaremos a reintroducir alimentos suavemente.',
    phase_reintro_badge: 'FASE DE REINTRODUCCIÓN',
    phase_reintro_headline: 'Semana {n} de ~{total}',
    phase_reintro_body: 'Probando un grupo FODMAP a la vez. Consulta tu plan completo en la pestaña Mi plan.',
    mood_null_title: 'Veamos cómo va el día',
    mood_null_sub: 'Registra una comida o síntoma y Flora reaccionará.',
    mood_good_title: 'Flora se siente tranquila hoy',
    mood_good_sub_streak: 'Sin brotes en {n} {unit}. Mantén el ritmo.',
    mood_good_sub: 'Tu intestino tiene un buen día.',
    mood_soso_title: 'Un día más o menos',
    mood_soso_sub: 'Señales mixtas hoy — sigue registrando para encontrar la causa.',
    mood_bad_title: 'Flora no se siente bien',
    mood_bad_sub: 'Un día intestinal difícil. Sé amable contigo.',
    colony_title: 'La colonia de Flora',
    colony_thriving: 'Colonia floreciente 🎉',
    colony_points_all: '{n} puntos · los 12 microbios',
    colony_points: '{n} puntos · {to} para el nivel {next}',
    colony_earned: 'Cómo has ganado puntos',
    colony_row_symFree: 'Días sin síntomas', colony_row_symFree_how: '+20 por cada día tranquilo',
    colony_row_meals: 'Comidas bajas en FODMAP', colony_row_meals_how: '+5 por comida segura (máx. 3/día)',
    colony_row_logging: 'Registro diario', colony_row_logging_how: '+10 por registrar algo ese día',
    colony_row_reintro: 'Tests de reintroducción', colony_row_reintro_how: '+50 por test completado',
    colony_footer: 'Flora crece con tus hábitos intestinales. Los días difíciles no te restan puntos — la constancia es lo que cuenta.',
    levelup_badge_complete: '🎉 COLONIA COMPLETA',
    levelup_title_complete: '¡Una colonia completa y floreciente!',
    levelup_body_complete: 'Has cultivado los 12 microbios — una comunidad intestinal diversa y sana. Ahora mantenla floreciente.',
    levelup_badge: 'SUBIDA DE NIVEL',
    levelup_title: 'Nivel {n}',
    levelup_body: '¡Flora ahora es {form}! Tus hábitos están dando frutos.',
    levelup_member_badge: 'NUEVO MIEMBRO DE LA COLONIA',
    levelup_member_body: 'Un nuevo microbio se unió a la colonia de Flora: tus hábitos están dando frutos.',
    levelup_btn: '¡Genial!',
    lf_meal_low_title: '¡Buena elección!', lf_meal_low_msg: 'Esa comida es suave para tu intestino. Flora lo aprueba.',
    lf_meal_mod_title: 'Comida moderada', lf_meal_mod_msg: 'Bien en porciones pequeñas — vigila el efecto acumulativo hoy.',
    lf_meal_high_title: 'Comida alta en FODMAP', lf_meal_high_msg: 'Esta puede revolver las cosas. Observa cómo te sientes después.',
    lf_symptom_high_title: 'Aguanta', lf_symptom_high_msg: 'Lo siento, no te sientes bien. Registrarlo ayuda a encontrar la causa.',
    lf_symptom_low_title: 'Anotado', lf_symptom_low_msg: 'Registrado. Espero que mejores pronto.',
    lf_sleep_great_title: '¡Bien descansado/a!', lf_sleep_great_msg: 'Un buen sueño ayuda a tu intestino a recuperarse. ¡Muy bien!',
    lf_sleep_ok_title: 'Noche aceptable', lf_sleep_ok_msg: 'Descanso decente — un poco más ayudaría a tu intestino.',
    lf_sleep_short_title: 'Noche corta', lf_sleep_short_msg: 'Dormir poco puede amplificar los síntomas. Sé amable contigo hoy.',
    lf_stress_low_title: 'Bien tranquilo/a', lf_stress_low_msg: 'El poco estrés es genial para tu intestino. Sigue así.',
    lf_stress_mid_title: 'Manejable', lf_stress_mid_msg: 'Un día regular — unas respiraciones profundas pueden ayudar.',
    lf_stress_high_title: 'Mucho estrés', lf_stress_high_msg: 'El estrés y el intestino van de la mano. Intenta desconectar un poco.',
    lf_got_it: 'Entendido',
    progress_title: 'Mi progreso',
    progress_last7: 'ÚLTIMOS 7 DÍAS',
    progress_gut_score: 'puntuación intestinal',
    progress_calm_days: 'Días tranquilos',
    progress_adherence: 'Adherencia',
    progress_avg_sleep: 'Sueño promedio',
    progress_adherence_title: 'Adherencia baja en FODMAP',
    progress_adherence_sub: 'Proporción de comidas con alimentos seguros',
    progress_symptoms_title: 'Síntomas',
    progress_symptoms_sub: 'Menos es mejor',
    progress_symptoms_this_week: '{n} esta semana',
    progress_sleep_title: 'Sueño',
    progress_sleep_sub: 'Horas por noche',
    progress_sleep_avg: 'promedio {n}h',
    progress_avg_water: 'Agua media',
    progress_water_title: 'Agua',
    progress_water_sub: 'Vasos por día',
    progress_water_avg: 'promedio {n}',
    progress_score_null: 'Sigue registrando para ver tu puntuación semanal',
    progress_score_good: 'Tu intestino tuvo una semana tranquila y estable',
    progress_score_mid: 'Una semana mixta — algunas cosas a observar',
    progress_score_bad: 'Una semana difícil — sé amable contigo',
    progress_flora_body: 'Flora crece con tus hábitos semanales.',
    log_chooser_title: '¿Qué quieres registrar?',
    log_meal_sub: 'Busca alimentos, escanea o usa IA',
    log_symptom_sub: 'Cómo te sientes',
    log_sleep_sub: 'Registrar horas',
    log_stress_sub: 'Capturar nivel de estrés',
    nudge_lifestyle: 'Añade también sueño, estrés y agua: afina tus patrones.',
    sleep_title: 'Registrar sueño',
    sleep_hours_label: 'Horas dormidas: {n}h',
    stress_title: 'Registrar estrés',
    stress_label: 'Estrés: {label}',
    stress_calm: 'Tranquilo/a', stress_mild: 'Leve', stress_manageable: 'Manejable',
    stress_tense: 'Tenso/a', stress_overwhelmed: 'Agobiado/a',
    symptom_title: 'Registrar síntoma',
    symptom_q: '¿Cómo te sientes?',
    symptom_intensity: 'Intensidad ({n}/5)',
    symptom_log_btn: 'Registrar',
    symptom_bloating: 'Hinchazón', symptom_pain: 'Dolor', symptom_gas: 'Gases',
    symptom_diarrhea: 'Diarrea', symptom_constipation: 'Estreñimiento', symptom_nausea: 'Náuseas',
    paywall_headline_default: 'Desbloquea el recorrido completo de GutBloom',
    paywall_sub_default: 'Premium te da todo lo que necesitas para el recorrido completo de eliminación a reintroducción.',
    paywall_headline_reintro: 'Desbloquea tu reintroducción completa',
    paywall_sub_reintro: 'Completaste tu primer desafío alimentario. Premium desbloquea los cinco grupos FODMAP restantes — la parte que te da tu lista personal de alimentos seguros.',
    paywall_headline_recipes: 'Desbloquea más de 50 recetas',
    paywall_sub_recipes: 'Ya exploraste las recetas gratuitas. Premium abre la biblioteca completa de comidas seguras para la eliminación de todas las cocinas.',
    paywall_headline_history: 'Ve tu historial completo de patrones',
    paywall_sub_history: 'La versión gratuita muestra esta semana. Premium guarda tu historial completo para que veas patrones acumulados durante meses.',
    paywall_headline_export: 'Exporta tus datos para tu médico',
    paywall_sub_export: 'Genera un PDF limpio de tus síntomas, desencadenantes y progreso para compartir con tu médico o dietista.',
    paywall_headline_scan: 'El escáner de comidas por IA es una función Premium',
    paywall_sub_scan: 'Fotografía una comida para una estimación rápida de FODMAP. Premium incluye 30 escaneos al mes. La búsqueda de alimentos y el escáner de código de barras siguen siendo gratuitos.',
    paywall_feat_reintro: 'Reintroducción completa', paywall_feat_reintro_sub: 'Prueba los 6 grupos FODMAP, no solo el primero',
    paywall_feat_recipes: 'Más de 50 recetas', paywall_feat_recipes_sub: 'Todas las comidas seguras, todas las cocinas',
    paywall_feat_scan: 'Tu mapa FODMAP personal', paywall_feat_scan_sub: 'Descubre exactamente qué alimentos y porciones te sientan bien',
    paywall_feat_history: 'Historial completo de patrones', paywall_feat_history_sub: 'Ve tendencias durante meses, no solo esta semana',
    paywall_feat_export: 'Exportación para el médico', paywall_feat_export_sub: 'Un PDF limpio de tus datos para las consultas',
    paywall_free_note: 'La búsqueda de alimentos, el escáner de código de barras, el registro, GutGuide y la fase de eliminación completa siguen siendo gratuitos, siempre. Premium desbloquea la reintroducción y todo lo que viene después.',
    paywall_best_badge: 'IDEAL PARA EL RECORRIDO',
    paywall_trial_note: '{price}. Cancela cuando quieras. Sin anuncios, nunca.',
    paywall_trial_btn: 'Obtener Premium',
    paywall_annual_price: '69 €/año · unos 5,75 €/mes',
    paywall_monthly_price: '8,99 €/mes',
    annual: 'Anual', monthly: 'Mensual',
    settings_title: 'Ajustes',
    settings_premium_active_sub: 'Tu recorrido completo está desbloqueado. Gracias por tu apoyo.',
    settings_mid_journey: '¿Ya estás a mitad del camino? Actualiza tu fase manualmente.',
    settings_current_phase: 'Fase actual',
    settings_phase_not_started: 'Aún no empezado',
    settings_phase_elimination: 'Eliminación',
    settings_phase_reintroduction: 'Reintroducción',
    settings_week_label: 'Ya estoy en la semana nº',
    settings_week_sub: 'Ajustaremos tu fecha de inicio en consecuencia.',
    settings_menstruate_q: '¿Tienes menstruación?',
    settings_menstruate_sub: 'Si es así, mostramos un rastreador de período en la pantalla de inicio para detectar patrones hormonales.',
    settings_other_intolerances: 'Otras intolerancias', settings_none: 'Ninguna',
    settings_other_intolerances_sub: 'Marcaremos alimentos que son bajos en FODMAP pero problemáticos para estas intolerancias.',
    settings_doctor_summary: 'Resumen para el médico', settings_doctor_export_btn: 'Exportar resumen para el médico',
    settings_doctor_sub: 'Exporta tus datos como resumen para compartir con tu médico o dietista.',
    settings_save_phase: 'Guardar cambios de fase',
    settings_custom_foods: 'Tus alimentos personalizados', settings_custom_foods_sub: 'Alimentos que añadiste. Toca un punto para cambiar su nivel FODMAP, o ✕ para eliminar.',
    settings_start_over: 'Empezar de nuevo',
    settings_start_over_sub: 'Borra todos tus datos — perfil, registros y progreso — y repite el proceso de inicio. No se puede deshacer.',
    settings_reset_confirm: 'Sí, borrar todo',
    settings_reset_btn: 'Restablecer app',
    settings_disclaimer_title: 'Aviso de salud',
    settings_disclaimer_body: 'GutBloom es una herramienta de bienestar y seguimiento, no un dispositivo médico ni un sustituto del asesoramiento, diagnóstico o tratamiento médico profesional. No diagnostica afecciones ni reemplaza a tu médico. Ante cualquier duda médica, consulta siempre a un profesional de la salud. La dieta baja en FODMAP funciona mejor con un diagnóstico de SII y el apoyo de un dietista formado en FODMAP. Si tienes síntomas graves o alarmantes, contacta a un profesional médico.',
    settings_terms: 'Términos de servicio', settings_privacy: 'Política de privacidad',
    plan_sub: 'Tu camino FODMAP en dos fases',
    plan_period_pause: 'Considera una pausa',
    plan_period_pause_sub: 'El período puede amplificar los síntomas un 30–40 %.',
    plan_phase1_eyebrow: 'FASE 1', plan_phase1_title: 'Eliminación',
    plan_phase1_body: 'Hacemos una pausa temporal en los alimentos desencadenantes más comunes para calmar el intestino y crear una línea base clara — para que las reacciones sean más fáciles de detectar después.',
    plan_elim_in_progress: 'En curso — ve los alimentos en pausa en tu pantalla de inicio',
    plan_elim_done: 'Completado — tu intestino tuvo tiempo de calmarse',
    plan_phase2_eyebrow: 'FASE 2', plan_phase2_title: 'Reintroducción',
    plan_phase2_body: 'Un alimento a la vez, los vamos reintroduciendo y observamos cómo responde tu cuerpo — descubriendo tus desencadenantes reales y ampliando tu dieta de forma segura.',
    plan_reintro_locked: 'Se desbloquea tras la eliminación',
    plan_start_reintro: 'Iniciar fase de reintroducción',
    plan_status_current: 'ACTUAL', plan_status_completed: 'COMPLETADO', plan_status_upcoming: 'PRÓXIMO',
    plan_what_now: 'QUÉ HACER AHORA',
    plan_categories: 'Categorías ({n}/6 completadas)',
    plan_tolerated: 'Tolerado', plan_trigger: 'Desencadenante identificado',
    plan_in_progress: 'En progreso', plan_premium_tap: 'Premium — toca para desbloquear',
    plan_tap_start: 'Toca para empezar', plan_locked_until: 'Bloqueado hasta que estés listo/a',
    plan_continue_reintro_title: '🌱 Continúa tu reintroducción',
    plan_continue_reintro_body: 'Completaste tu primer desafío alimentario. Premium desbloquea los cinco restantes — la parte que construye tu lista personal de alimentos seguros.',
    plan_disclaimer: 'Este plan es una orientación general, no un consejo médico. La dieta baja en FODMAP funciona mejor con un diagnóstico de SII y un dietista formado en FODMAP. Detente y busca atención si los síntomas son graves.',
    test_active_badge: 'TEST ACTIVO - DÍA {day} DE 3',
    test_portion: 'Porción de hoy: {portion}',
    test_no_reaction: 'Sin reacción', test_reacted: 'Con reacción',
    test_day_logged_next: 'Día {day} registrado. Vuelve mañana para la porción {portion}.',
    test_day_logged_done: 'Día {day} registrado. ¡Test completado!',
    test_cancel: 'Cancelar test',
    test_modal_title: 'Probar {name}',
    test_protocol_badge: 'Protocolo Monash de 3 días',
    test_protocol_body: 'Día 1: porción pequeña — Día 2: media — Día 3: grande\nSi reaccionas algún día, el test se detiene antes. Tras 3 días, descansa {rest} días antes de la siguiente categoría.',
    test_pick_food: 'Elige un alimento de prueba',
    test_day_portions: 'Día 1: {s} — Día 2: {m} — Día 3: {l}',
    test_start_btn: 'Iniciar test de 3 días',
    test_badge: 'TEST REINTRO',
    test_count_q: '¿Contar esto como el test de hoy?',
    test_logged_q: 'Registraste {food}, que forma parte de tu reintroducción de {cat}. ¿Tuviste alguna reacción?',
    test_how_bad: '¿Cómo de intenso? ({n}/5)',
    test_save_btn: 'Guardar resultado del test',
    test_skip_link: 'Omitir — no forma parte del test',
    toast_elim_started: 'Fase de eliminación iniciada',
    toast_reintro_started: 'Fase de reintroducción iniciada',
    toast_updated: 'Entrada actualizada',
    toast_deleted: 'Entrada eliminada',
    toast_test_cancelled: 'Test cancelado',
    toast_test_started: 'Test iniciado',
    toast_test_tolerated: 'Test completo — ¡tolerado!',
    toast_test_complete: 'Test completo',
    toast_day_logged: 'Día {n} registrado',
    toast_product_logged: '{name} registrado',
    toast_ai_logged: 'Escáner de IA registrado',
    toast_welcome_premium: 'Bienvenido/a a Premium — tu recorrido completo está desbloqueado',
    toast_diagnosed: 'Gracias — eso nos ayuda a personalizar tu plan',
    toast_period_started: 'Período iniciado',
    toast_period_ended: 'Período terminado',
    edit_title: 'Editar entrada',
    edit_foods_label: 'Alimentos (solo lectura)',
    edit_portion: 'Porción',
    edit_portion_s: 'Pequeña', edit_portion_m: 'Mediana', edit_portion_l: 'Grande',
    portion_or_less: 'o menos', portion_or_more: 'o más',
    unit_piece_one: 'pieza', unit_piece_other: 'piezas', unit_slice_one: 'rebanada', unit_slice_other: 'rebanadas',
    meal_portion_hint: 'Ajusta la ración de cada ingrediente. Los tamaños se adaptan a cada alimento, con M como ración típica.',
    meal_dish_contains: 'Contiene',
    edit_hours_label: 'Horas: {n}h',
    edit_intensity_label: 'Intensidad ({n}/5)',
    edit_stress_label: 'Nivel de estrés: {n}/5',
    edit_save_btn: 'Guardar cambios',
    edit_log_again: 'Registrar de nuevo ahora',
    edit_log_again_hint: 'Añade estos alimentos como nueva entrada, con la hora actual — esta no cambia',
    edit_delete_btn: 'Eliminar entrada',
    barcode_title: 'Escanear código de barras',
    barcode_point: 'Apunta al código de barras',
    barcode_cam_needed: 'Se necesita permiso de cámara',
    barcode_allow: 'Permitir',
    barcode_looking: 'Buscando',
    barcode_found: 'ENCONTRADO',
    barcode_risk: 'RIESGO FODMAP',
    barcode_high: 'Alto riesgo', barcode_low: 'Probablemente seguro',
    barcode_ingredients: 'INGREDIENTES',
    barcode_scan_another: 'Escanear otro',
    barcode_add: 'Añadir al registro',
    risk_low: 'Bajo', risk_moderate: 'Moderado', risk_high: 'Alto',
    list_fermented: 'FERMENTADO', list_tolerated: 'tolerado', list_trigger: 'desencadenante',
    hist_high: 'ALTO', hist_mod: 'MOD', hist_liberator: 'LIBERADOR',
    pill_day: 'Día {n}', detail_ferm_tag: 'FERMENTACIÓN', app_tagline: 'Tu intestino, en buenas manos',
    form_seedling: 'Semilla', form_sprout: 'Brote', form_growing: 'Creciendo',
    form_blooming: 'Floreciendo', form_thriving: 'Próspera',

    // Meal modal
    meal_modal_title: 'Registrar una comida',
    meal_discard_title: '¿Descartar esta comida?',
    meal_discard_body: 'Aún no se ha guardado: perderás los alimentos seleccionados.',
    meal_discard_keep: 'Seguir editando',
    meal_discard_confirm: 'Descartar',
    meal_modal_search_ph: 'Buscar cualquier alimento',
    meal_modal_scan_btn: 'Escanear código de barras',
    barcode_intro_title: 'Escanear un código de barras',
    barcode_intro_body: 'Apunta la cámara al código de barras de un producto envasado y GutBloom lo busca, mostrando su probable riesgo FODMAP y los ingredientes desencadenantes, para que decidas antes de comer.',
    barcode_intro_cta: 'Escanear ahora',
    barcode_intro_later: 'Quizá más tarde',
    meal_modal_your_meal: 'Tu comida',
    meal_edit_portion_of: 'Editar porción: {food}', meal_remove_item: 'Quitar de la comida', meal_dish_remove_hint: 'Toca un ingrediente para quitarlo', meal_dish_add_hint: '¿Lo comiste con extras (salsa, dip o guarnición)? Añádelos desde la búsqueda en la pantalla de comida.', meal_ingredient_removed: 'quitado',
    meal_base_hint: 'Esto es una base — añade los demás ingredientes que usaste (queso, verduras, coberturas…) para que la puntuación coincida con tu plato.',
    meal_modal_hist_alert: 'Alerta de histamina',
    meal_modal_high_hist: 'Alta histamina: {foods}.',
    meal_modal_hist_lib: 'Liberadores de histamina: {foods}.',
    meal_modal_hist_note: 'Esta comida puede ser baja en FODMAP pero seguir siendo problemática para ti.',
    meal_modal_results: 'Resultados',
    meal_modal_recent: 'Alimentos recientes',
    meal_modal_recent_meals: 'Comidas recientes',
    meal_type_label: 'Tipo', meal_type_breakfast: 'Desayuno', meal_type_lunch: 'Almuerzo', meal_type_dinner: 'Cena', meal_type_snack: 'Tentempié',
    meal_my_breakfast: 'Mi desayuno', meal_my_lunch: 'Mi almuerzo', meal_my_dinner: 'Mi cena', meal_my_snack: 'Mi tentempié',
    edit_dish: 'Plato', meal_edit_extras: 'Ingredientes añadidos', meal_edit_foods: 'Alimentos', meal_edit_add: 'Añadir alimento', meal_edit_none: 'Sin alimentos — añade al menos uno.', edit_now_custom: 'Cambiaste los ingredientes: ahora es una comida personalizada.',
    meal_custom_q: '¿No encuentras "{name}"?',
    meal_custom_tip: 'Consejo: si es una mezcla (como una paella), añade los ingredientes individuales en su lugar — obtendrás veredictos más precisos.',
    meal_custom_add: 'Elige su nivel FODMAP:',
    meal_custom_low_desc: 'arroz, carne, huevos, zanahorias, patatas, cheddar, fresas',
    meal_custom_mod_desc: 'avena, pasta, leche de vaca, champiñones, garbanzos',
    meal_custom_high_desc: 'ajo, cebolla, trigo, legumbres, miel, frutas de hueso',
    meal_modal_pick: 'Elige alimentos para registrar tu comida',
    meal_modal_items_one: '{n} alimento', meal_modal_items: '{n} alimentos',
    meal_low: 'Bajo en FODMAP', meal_moderate: 'Moderado', meal_high: 'Alto en FODMAP',
    meal_reason_from: 'por {food}', meal_reason_stack: 'FODMAP moderados que se acumulan',
    meal_why_label: 'Por qué',
    meal_swap_tip: 'Cambia {food} → {alt}',
  },
  fr: {
    // Account / authentication
    account: 'Compte', account_sub: 'Connecte-toi pour sauvegarder et synchroniser ton parcours sur tous tes appareils.',
    account_signed_in: 'Connecté', account_manage: 'Gérer le compte',
    sign_in: 'Se connecter', sign_up: 'Créer un compte', sign_out: 'Se déconnecter',
    auth_title_login: 'Bon retour', auth_title_signup: 'Crée ton compte', auth_title_reset: 'Réinitialiser le mot de passe',
    auth_sub_login: 'Connecte-toi pour synchroniser ton parcours sur tous tes appareils.',
    auth_sub_signup: 'Tes données restent les tiennes — un compte les sauvegarde et les synchronise.',
    auth_sub_reset: 'Saisis ton e-mail et nous t\'enverrons un lien de réinitialisation.',
    auth_email: 'E-mail', auth_email_ph: 'toi@exemple.com',
    auth_password: 'Mot de passe', auth_password_ph: 'Au moins 6 caractères',
    auth_forgot: 'Mot de passe oublié ?',
    auth_to_signup: 'Nouveau ici ? Crée un compte', auth_to_login: 'Déjà un compte ? Connecte-toi',
    auth_send_reset: 'Envoyer le lien', auth_back_to_login: 'Retour à la connexion',
    auth_err_empty: 'Saisis ton e-mail et ton mot de passe.',
    auth_err_email: 'Saisis une adresse e-mail valide.',
    auth_err_password_short: 'Le mot de passe doit comporter au moins 6 caractères.',
    auth_err_generic: 'Une erreur est survenue. Réessaie.',
    auth_err_credentials: 'E-mail ou mot de passe incorrect.',
    auth_err_exists: 'Cet e-mail est déjà enregistré — connecte-toi.',
    auth_err_send: "Impossible d'envoyer l'e-mail de confirmation. Vérifie l'adresse ou réessaie bientôt.",
    auth_err_unconfirmed: "Confirme d'abord ton e-mail — vérifie ta boîte de réception.",
    auth_err_mismatch: 'Les mots de passe ne correspondent pas.',
    auth_confirm_password: 'Confirmer le mot de passe', auth_confirm_password_ph: 'Ressaisis ton mot de passe',
    auth_show_password: 'Afficher le mot de passe', auth_hide_password: 'Masquer le mot de passe',
    auth_sent_title: 'Vérifie tes e-mails', auth_sent_body: 'Nous avons envoyé un lien de confirmation à {email}. Ouvre-le pour activer ton compte, puis connecte-toi.',
    auth_reset_sent_body: 'Si {email} a un compte, un lien de réinitialisation est en route. Ouvre-le pour choisir un nouveau mot de passe.',
    account_nudge_title: 'Sauvegarde ta progression', account_nudge_sub: 'Crée un compte gratuit pour sauvegarder ton journal et ta colonie.', account_nudge_cta: 'Créer un compte gratuit', account_nudge_row_sub: 'Sauvegarde journal & colonie',
    levelup_save_cta: 'Sauvegarde ta colonie — crée un compte gratuit',
    sync_now: 'Synchroniser', sync_syncing: 'Synchronisation…', sync_last: 'Dernière synchro {time}', sync_never: 'Pas encore synchronisé', sync_failed: 'Échec de la synchro — nouvelle tentative à venir.',
    account_sync_sub: 'Tes entrées et aliments personnalisés sont sauvegardés et synchronisés automatiquement.',
    auth_check_email: 'Presque fini ! Vérifie tes e-mails pour confirmer ton compte, puis connecte-toi.',
    auth_reset_sent: 'Si cet e-mail est enregistré, un lien est en route.',
    auth_signed_out: 'Déconnecté.', auth_welcome_toast: 'Connecté. Bon retour ! 🌱',
    auth_linked_note: 'Tes données existantes sont désormais liées à ton compte.',
    sync_now: 'Synchroniser', sync_syncing: 'Synchronisation…', sync_last: 'Dernière synchro {time}', sync_never: 'Pas encore synchronisé', sync_failed: 'Échec de la synchro — nouvelle tentative à venir.',
    account_sync_sub: 'Tes entrées et aliments personnalisés sont sauvegardés et synchronisés automatiquement.',
    continue: 'Continuer', back: 'Retour', save: 'Enregistrer', close: 'Fermer', gotIt: 'Compris', a11y_clear: 'Effacer la recherche', a11y_remove: 'Retirer', a11y_add_log: 'Ajouter une entrée',
    cancel: 'Annuler', done: 'Terminé', skip: 'Passer',
    tab_home: "Aujourd'hui", tab_foods: 'Aliments', tab_plan: 'Mon plan', tab_guide: 'GutGuide',
    onb_name_q: 'Quel est ton prénom ?', onb_name_sub: 'Ton prénom suffit.', onb_name_ph: 'Ton prénom',
    onb_safety_q: 'Avant de commencer', onb_safety_sub: 'Une rapide vérification de santé — c\'est important.',
    onb_start: 'Démarrer GutBloom',
    home_greeting: 'Bonjour',
    home_patterns: 'Mes tendances', home_todays_meals: 'Repas du jour',
    foods_title: 'Explorateur d\'aliments', foods_sub: 'Cherche un aliment, vois les déclencheurs et portions sûres',
    foods_search: 'Chercher un aliment', foods_count: '{n} aliments',
    foods_no_results: 'Aucun aliment ne correspond à ces filtres.', foods_clear_filters: 'Effacer les filtres',
    filter_all: 'Tous', filter_dishes: 'Plats', filter_high: 'Élevé', filter_mod: 'Modéré', filter_low: 'Faible',
    filter_category: 'Catégorie', cat_modal_title: 'Filtrer par catégorie', cat_modal_clear: 'Effacer', cat_modal_done: 'Voir {n} aliments',
    grp_fruit: 'Fruits', grp_veg: 'Légumes', grp_dairy: 'Produits laitiers', grp_protein: 'Protéines', grp_grain: 'Céréales', grp_drink: 'Boissons', grp_nut: 'Noix & graines', grp_sauce: 'Sauces', grp_sweet: 'Sucreries', grp_legume: 'Légumineuses',
    plan_title: 'Mon plan',
    guide_title: 'GutGuide', guide_sub: '50 réponses honnêtes aux questions courantes sur les FODMAP',
    guide_search: 'Chercher une question',
    log_meal: 'Noter un repas', log_symptom: 'Noter un symptôme', log_sleep: 'Noter le sommeil', log_stress: 'Noter le stress',
    log_water: 'Noter l’eau', log_water_sub: 'Suis ton hydratation', water_title: 'Eau', water_amount_label: 'Combien de verres as-tu bus ?', water_glasses_one: '{n} verre', water_glasses: '{n} verres', water_unit_hint: '1 verre ≈ 200 ml', water_why_title: 'Pourquoi l’hydratation compte', water_why: 'Bien s’hydrater aide la digestion à avancer et garde les selles souples — cela prévient la constipation et les ballonnements fréquents avec le SII, surtout quand tu augmentes les fibres.', lf_water_title: 'Bien joué', lf_water_msg: 'Chaque verre aide ton intestin à rester en mouvement.', lf_water_goal_title: 'Objectif d’hydratation atteint !', lf_water_goal_msg: 'Les {goal} verres bus — environ {liters} L aujourd’hui. Ton intestin adore.', edit_water_label: 'Verres', water_progress: '{n} / {goal} verres · ≈ {liters} L', water_goal_reached: 'Objectif atteint — bien hydraté !',
    settings: 'Réglages', upgrade: 'Passer à Premium', premium_active: 'GutBloom Premium',
    paywall_cta: 'Obtenir Premium', plan_annual: 'Annuel', plan_monthly: 'Mensuel',
    save_meal: 'Enregistrer le repas', doctor_summary: 'Résumé pour le médecin',
    lang_label: 'Langue', lang_auto: 'Automatique (langue du téléphone)',
    foods_src_note: "Les indications sur les aliments reposent sur les principes établis du régime pauvre en FODMAP, à titre d'orientation générale, et non sur des valeurs testées en laboratoire. L'app FODMAP de l'Université Monash est la référence clinique pour les seuils précis.",
    detail_trigger_head: "À quelle fréquence c'est un déclencheur", detail_portion_head: 'Conseils de portion',
    detail_swap_head: 'Mange plutôt ceci', detail_why_head: "Pourquoi c'est un déclencheur",
    detail_swap_sub: "Pas besoin de renoncer au goût — ces alternatives pauvres en FODMAP font le même travail.",
    detail_lighten_head: 'Comment le rendre pauvre en FODMAP', detail_lighten_sub: "De petits changements qui réduisent la charge en FODMAP — même goût, plus doux pour l'intestin.",
    detail_tolerate: 'TU LE TOLÈRES', detail_trigger: 'ÇA TE DÉCLENCHE DES SYMPTÔMES',
    detail_cross_warn: 'Avertissement d\'intolérance croisée',
    detail_hist_high: "Riche en histamine — probablement problématique si tu réagis aux aliments vieillis ou fermentés.",
    fermented_tolerance_note: 'Fermenté — souvent mieux toléré que les produits laitiers ordinaires',
    small_portion_note: 'OK en petite portion (environ 40 g)',
    food_base_note: 'Recette de base — ajoute tes ingrédients',
    detail_hist_mod: "Histamine modérée — généralement tolérée en petites portions.",
    detail_hist_lib: "Libérateur d'histamine — n'en contient pas mais peut déclencher ta production.",
    detail_profile_note: 'Selon ton profil. Modifiable dans les Réglages.',
    detail_portion_safe: 'Sûr en toute quantité',
    detail_portion_low_then: "Faible jusqu'à {g}g, puis modéré",
    detail_portion_low: "Jusqu'à {g}g — Faible en FODMAP",
    detail_portion_mod: '{lo}–{hi}g — Modéré',
    detail_portion_high_label: 'Au-delà de {g}g — Élevé',
    detail_portion_high_note: 'Élevé en FODMAP quelle que soit la quantité. À éviter pendant l\'élimination.',
    detail_ferm_good: 'BON À SAVOIR', detail_ferm_caution: 'ATTENTION', detail_ferm_mixed: 'TABLEAU MIXTE',
    detail_trigger_note: 'Un guide général pour les personnes atteintes de SII. Ta propre tolérance compte — la phase de réintroduction te le montrera.',
    band_common: 'Déclencheur fréquent', band_sometimes: 'Parfois déclencheur', band_rarely: 'Rarement déclencheur',
    band_common_s: 'Fréquent', band_sometimes_s: 'Parfois', band_rarely_s: 'Rarement',
    recipes_title: 'Recettes',
    recipes_flora_sub: 'Des repas bons pour l\'intestin que Flora adore cuisiner',
    recipes_upsell_headline: 'Cuisiner sans limites',
    recipes_upsell_sub: 'Tu as essayé {free} recettes sur {total} — voici tout le reste.',
    recipes_upsell_bullet1: 'Toutes les {n} recettes bonnes pour l\'intestin',
    recipes_upsell_bullet2: 'Plan de réintroduction complet étape par étape',
    recipes_upsell_bullet3: 'Export de données prêt pour le médecin',
    recipes_unlock_btn: 'Débloquer Premium',
    recipe_premium_locked: 'Recette Premium — appuyer pour débloquer',
    recipe_meta: '{meal} · {min} min · {ing} ingrédients',
    recipe_badge_safe: 'SÛR EN ÉLIMINATION',
    recipe_ingredients: 'Ingrédients',
    recipe_steps: 'Étapes',
    recipe_log_btn: 'Consigner comme repas',
    meal_breakfast: 'Petit-déjeuner', meal_lunch: 'Déjeuner', meal_dinner: 'Dîner', meal_snack: 'Collation',
    guide_count: '{n} questions', guide_no_results: "Aucune question ne correspond. Essaie un autre mot ou thème.",
    guide_flora_title: 'Curieux·se sur les FODMAP ?',
    guide_flora_sub: 'Flora a des réponses honnêtes et simples aux questions les plus fréquentes.',
    scan_limit_title: 'Scans mensuels épuisés',
    scan_limit_body: 'Tu as utilisé tous tes {n} scans IA de ce mois. Ton quota se réinitialise en début de mois prochain. En attendant, tu peux continuer à noter des repas par recherche ou code-barres — tous deux illimités.',
    paywall_includes: 'Ce que Premium inclut',
    pattern_watch: 'À surveiller', pattern_noticed: 'Remarqué', pattern_good: 'Bon signe',
    patterns_empty: "Continue à noter tes repas et ton ressenti. Les tendances apparaissent après environ une semaine.",
    export_share: 'Partager le résumé',
    export_share_again: 'Partager à nouveau',
    export_modal_title: 'Résumé pour le médecin',
    export_appt_title: 'Un résumé pour ton rendez-vous',
    export_appt_body: 'Ceci compile tes données enregistrées, les résultats de réintroduction et les tendances observées en un résumé que tu peux envoyer à ton médecin ou diététicien. Appuie sur Partager pour l\'envoyer par e-mail, messagerie ou le sauvegarder en note.',
    export_preview_label: 'Aperçu',
    export_shared: 'Partagé !',
    export_shared_note: 'Résumé partagé. Tu peux l\'envoyer à nouveau à tout moment.',
    export_disclaimer: 'Ceci reflète des données auto-déclarées et vient en complément — sans remplacer — l\'évaluation médicale professionnelle.',
    recipe_how_to: 'Comment le préparer',
    recipe_log_full_btn: 'Je l\'ai cuisiné · Consigner comme repas',
    recipe_portions_note: 'Les portions sont indicatives. Consulte l\'Explorateur d\'aliments pour les limites sûres des ingrédients à teneur modérée en FODMAP.',
    settings_premium_sub: 'Réintroduction complète, toutes les recettes, export médecin. Aucune publicité, jamais.',

    safety_ibs_q: 'As-tu reçu un diagnostic de syndrome de l\'intestin irritable (SII) d\'un médecin ?',
    safety_yes: 'Oui', safety_no: 'Non', safety_unsure: 'Pas sûr(e)',
    safety_no_diag_note: 'Le régime pauvre en FODMAP est conçu comme un outil après un diagnostic de SII. Les mêmes symptômes peuvent venir d\'autres affections qui nécessitent un traitement différent — mieux vaut voir un médecin d\'abord. Tu peux quand même explorer GutBloom pour apprendre.',
    safety_flags_q: 'Est-ce que tu as l\'un de ces symptômes ?',
    safety_flags_sub: 'Coche tout ce qui s\'applique. Laisse vide si aucun.',
    safety_flag_blood: 'Sang dans les selles',
    safety_flag_weightloss: 'Perte de poids inexpliquée',
    safety_flag_newover50: 'Nouveaux symptômes digestifs apparus après 50 ans',
    safety_flag_famhistory: 'Antécédents familiaux de cancer du côlon, de maladie cœliaque ou de MICI',
    safety_flag_anemia: 'Anémie ou faible taux de fer',
    safety_flag_fever: 'Fièvre accompagnant les symptômes digestifs',
    safety_flag_nightwake: 'Symptômes qui te réveillent la nuit',
    safety_warn_title: 'Consulte un médecin avant de modifier ton alimentation',
    safety_warn_body: 'Certains de tes symptômes sont ce que les médecins appellent des « signaux d\'alerte ». Cela ne veut pas dire que quelque chose de grave se passe — mais tu devrais être évalué(e) avant de commencer un régime restrictif, car les changements alimentaires peuvent masquer quelque chose qui mérite attention.',
    safety_warn_ack: 'Je comprends et j\'ai décidé de continuer.',
    onb_step: 'Étape {n} sur {total}',
    onb_flora_intro: 'Salut, je suis Flora — ta complice intestinale',
    onb_ibs_q: 'C\'est quoi le SII ?',
    onb_ibs_card1_title: 'Une affection très courante',
    onb_ibs_card1_body: 'Le syndrome de l\'intestin irritable (SII) touche environ 1 personne sur 10 dans le monde. Ce n\'est pas une maladie — c\'est un trouble fonctionnel de l\'intestin : l\'intestin est sensible et réactif, mais pas endommagé.',
    onb_ibs_card2_title: 'Les symptômes',
    onb_ibs_card2_body: 'Ballonnements, crampes, douleurs d\'estomac, diarrhée, constipation — ou un mélange qui change de jour en jour. Les symptômes sont réels et peuvent vraiment impacter le quotidien, même si les analyses reviennent souvent normales.',
    onb_ibs_card3_title: 'La bonne nouvelle',
    onb_ibs_card3_body: 'Le SII est gérable. L\'alimentation, le stress, le sommeil et la connaissance de tes déclencheurs personnels font une vraie différence. C\'est exactement ce que GutBloom t\'aide à faire.',
    onb_menstruate_q: 'As-tu des règles ?',
    onb_menstruate_sub: 'Les cycles hormonaux peuvent amplifier les symptômes du SII de 30 à 40 %. Si oui, on t\'aide à repérer les schémas liés au cycle. Tu peux changer ça à tout moment dans Réglages.',
    onb_menstruate_yes: 'Oui', onb_menstruate_no: 'Non',
    onb_fodmap_q: 'C\'est quoi FODMAP ?',
    onb_fodmap_card1_title: 'Un groupe de sucres fermentescibles',
    onb_fodmap_card1_body: 'FODMAP est l\'acronyme de Fermentable Oligosaccharides, Disaccharides, Monosaccharides And Polyols — une famille de glucides à courte chaîne présents dans de nombreux aliments courants. Dans les intestins sensibles, ils sont mal absorbés et fermentés par des bactéries, ce qui provoque des gaz, des ballonnements et des douleurs.',
    onb_fodmap_card2_title: 'Le régime pauvre en FODMAP',
    onb_fodmap_card2_body: 'Développé par l\'Université de Monash, c\'est l\'approche diététique la plus validée scientifiquement pour le SII. Tu élimines temporairement les aliments riches en FODMAP pour calmer l\'intestin, puis tu les réintroduis systématiquement pour trouver tes déclencheurs personnels.',
    onb_fodmap_card3_title: 'Deux phases, un objectif',
    onb_fodmap_card3_body: 'Phase 1 — Élimination (~4–6 semaines) : supprimer les déclencheurs, calmer l\'intestin. Phase 2 — Réintroduction (~8 semaines) : tester chaque groupe FODMAP pour savoir exactement quels aliments te posent problème. La plupart finissent avec une alimentation étonnamment variée.',
    onb_phase_q: 'Où en es-tu avec le FODMAP ?',
    onb_phase_sub: 'On t\'accompagne depuis là où tu es.',
    onb_phase_learning: 'Je découvre le sujet', onb_phase_curious: 'J\'envisage d\'essayer',
    onb_phase_elimination: 'En phase d\'élimination', onb_phase_reintro: 'Prêt(e) pour la réintroduction',
    onb_phase_maintenance: 'Phases formelles terminées',
    onb_symptom_q: 'Symptôme principal ?', onb_symptom_sub: 'Touche ce qui te ressemble le plus.',
    onb_symptom_bloat: 'Ballonnements après les repas', onb_symptom_pain: 'Douleurs ou crampes abdominales',
    onb_symptom_bowel: 'Diarrhée ou constipation', onb_symptom_multi: 'Plusieurs symptômes',
    onb_known_q: 'Des intolérances connues ?', onb_known_sub: 'Touche tout ce qui s\'applique. Passe si tu n\'es pas sûr(e).',
    onb_known_lactose: 'Lactose', onb_known_gluten: 'Gluten / Maladie cœliaque',
    onb_known_fructose: 'Fructose', onb_known_histamine: 'Histamine', onb_known_unknown: 'Pas encore sûr(e)',
    onb_sleep_q: 'Comment tu dors ?', onb_sleep_sub: 'Le sommeil influence les symptômes intestinaux plus qu\'on ne le croit.',
    onb_sleep_great: '7–9 heures, bien reposé(e)', onb_sleep_okay: '6–7 heures, globalement bien', onb_sleep_poor: 'Moins de 6 h ou agité(e)',
    onb_stress_q: 'Niveau de stress ?', onb_stress_sub: 'Le stress et l\'intestin sont étroitement liés.',
    onb_stress_low: 'Plutôt calme', onb_stress_mid: 'Gérable', onb_stress_high: 'Beaucoup de stress',
    home_empty_title: 'Prenons soin de ton intestin',
    home_empty_body: 'Note tes repas et comment tu te sens, repère les tendances et découvre ce que ton intestin aime — un jour à la fois, avec Flora à tes côtés.',
    home_before_start: 'AVANT DE COMMENCER',
    home_gp_title: 'Consulte ton médecin généraliste ou un gastro-entérologue',
    home_gp_sub: 'FODMAP est un outil après un diagnostic de SII. Touche pour voir comment ils peuvent t\'aider.',
    home_gp_confirm: 'Confirmer que c\'est le SII — et écarter d\'autres causes',
    home_gp_confirm_body: 'Des symptômes comme les tiens peuvent aussi venir de la maladie cœliaque ou d\'une maladie inflammatoire de l\'intestin. Ton médecin peut faire des analyses initiales et te référer à un spécialiste si nécessaire.',
    home_diagnosed: 'Je suis allé(e) chez le médecin et j\'ai un diagnostic',
    home_how_it_works: 'COMMENT ÇA MARCHE',
    home_how_intro: 'Les symptômes du SII sont souvent déclenchés par certains aliments, mais les déclencheurs diffèrent d\'une personne à l\'autre. GutBloom te guide avec une méthode éprouvée en deux phases pour trouver les tiens.',
    home_step1_title: 'Note repas & ressenti', home_step1_sub: 'Recherche rapide, code-barres ou scan IA',
    home_step2_title: 'Phase d\'élimination', home_step2_sub: 'Pendant 4 à 6 semaines, tu manges des aliments simples et doux pour l\'intestin qui posent rarement problème. Cela apaise ton intestin et crée une base claire, sans symptômes.',
    home_step3_title: 'Phase de réintroduction', home_step3_sub: 'Tu réintroduis les aliments un par un et observes la réaction de ton corps : c\'est ainsi que tu identifies tes vrais déclencheurs et ceux qui sont sûrs.',
    home_step4_title: 'Mange en confiance', home_step4_sub: 'Crée ta liste personnelle d\'aliments sûrs et de déclencheurs connus pour profiter des repas avec moins de crises.',
    home_how_note: 'Basé sur l\'approche pauvre en FODMAP pour le SII. GutBloom t\'accompagne mais ne remplace pas un avis médical : consulte ton médecin ou ta diététicienne.',
    home_how_more: 'En savoir plus', home_how_less: 'Voir moins',
    home_start_elim: 'Démarrer la phase d\'élimination',
    home_lets_start: 'C\'est parti',
    home_today: "Aujourd'hui", home_yesterday: 'Hier', home_journal: 'Journal', history_title: 'Historique', see_history: 'Voir toutes les entrées', home_see_progress: 'Voir mes progrès', patterns_see_all: 'Voir toutes les tendances',
    home_hi_name: 'Salut {name}', home_hi: 'Salut', home_journey_day: 'Jour {n} de ton parcours intestinal', home_eat_well: 'Bien manger aujourd\'hui', picker_select_day: 'Choisis un jour', meal_select_type: 'Choisis un type', progress_level_points: 'Niveau {level} · {points} points', a11y_take_photo: 'Prendre une photo', a11y_week_number: 'Numéro de semaine', a11y_week_decrease: 'Diminuer la semaine', a11y_week_increase: 'Augmenter la semaine', week_number_ph: 'p. ex. 2',
    recipes_all: 'Toutes les recettes', home_meals_sub: '4 repas compatibles élimination choisis pour toi. Touche-en un pour le voir.', patterns_empty_early: 'Continue à noter tes repas et ton ressenti. Les tendances apparaissent généralement après une semaine de données.', patterns_empty_none: 'Pas encore de tendance claire. Continue à noter — plus tes entrées sont régulières, plus les analyses sont précises.', patterns_sub: "Corrélations tirées de ton journal — pas des diagnostics. Sers-t'en pour décider quoi tester.", patterns_window: '{n} derniers jours', sev_watch: 'À SURVEILLER', sev_maybe: 'SIGNE PRÉCOCE', sev_info: 'REMARQUÉ', sev_good: 'BON SIGNE', show_less: 'Voir moins', show_more: 'Voir {n} de plus',
    colony_lv: 'Niv. {n} · {form}', colony_pts: '{n} points', colony_form_spore: 'Spore', colony_form_sprout: 'Pousse', colony_form_grown: 'Développée', colony_form_thriving: 'Florissante', colony_level_form: 'Niveau {n} · {form}',
    home_low_fodmap: 'Pauvre en FODMAP', home_symptoms: 'Symptômes', home_sleep: 'Sommeil',
    home_colony_title: 'La colonie de Flora', home_see_colony: 'Voir la colonie',
    home_colony_complete: 'Complète',
    home_colony_thriving: 'Colonie complète — continue ainsi !',
    home_days_thriving: '{n} {unit} en plein essor',
    home_day: 'jour', home_days: 'jours',
    home_to_level: 'pour le niveau {n}',
    period_turn_on: 'Activer quand tes règles commencent',
    period_turn_off: 'Désactiver quand elles se terminent',
    period_active: 'Règles actives', period_tracking: 'Suivi des règles',
    period_body: 'Les hormones peuvent amplifier les symptômes intestinaux de 30–40 % autour des règles. Ce suivi aide GutBloom à distinguer les effets hormonaux des vrais déclencheurs alimentaires.',
    timeline_entries: '{n} entrées — touche pour modifier',
    timeline_intensity: 'Intensité {n}/5',
    timeline_stress: 'Niveau de stress {n}/5',
    timeline_meal_fallback: 'Repas',
    timeline_extra_one: '+ {n} ingrédient', timeline_extra: '+ {n} ingrédients',
    phase_ready_title: 'Prêt(e) à commencer ?',
    phase_ready_body: 'Lance la phase d\'élimination pour identifier tes déclencheurs. Dure 4–6 semaines.',
    phase_plan_link: 'Voir mon plan',
    phase_elim_badge: 'PHASE DE REMISE À ZÉRO · SEMAINE {n}',
    phase_elim_headline_1: 'Tu prends soin de toi depuis 1 jour',
    phase_elim_headline_n: 'Tu prends soin de toi depuis {n} jours',
    phase_elim_body_early: 'La plupart des gens ressentent une vraie différence vers la semaine 2–3. Tu construis chaque jour une base de référence plus claire.',
    phase_elim_body_ready: 'Ton corps a eu le temps de se calmer. Quand tu es prêt(e), on va réintroduire les aliments doucement.',
    phase_reintro_badge: 'PHASE DE RÉINTRODUCTION',
    phase_reintro_headline: 'Semaine {n} sur ~{total}',
    phase_reintro_body: 'On teste un groupe FODMAP à la fois. Consulte ton plan complet dans l\'onglet Mon plan.',
    mood_null_title: 'Voyons comment se passe la journée',
    mood_null_sub: 'Note un repas ou un symptôme et Flora réagira.',
    mood_good_title: 'Flora se sent sereine aujourd\'hui',
    mood_good_sub_streak: 'Pas de poussée depuis {n} {unit}. Tiens le cap.',
    mood_good_sub: 'Ton intestin passe une bonne journée.',
    mood_soso_title: 'Une journée mi-figue, mi-raisin',
    mood_soso_sub: 'Signaux mitigés aujourd\'hui — continue à noter pour trouver la cause.',
    mood_bad_title: 'Flora ne se sent pas bien',
    mood_bad_sub: 'Une journée intestinale difficile. Sois indulgent(e) avec toi.',
    colony_title: 'La colonie de Flora',
    colony_thriving: 'Colonie florissante 🎉',
    colony_points_all: '{n} points · les 12 microbes',
    colony_points: '{n} points · {to} pour le niveau {next}',
    colony_earned: 'Comment tu as gagné tes points',
    colony_row_symFree: 'Jours sans symptômes', colony_row_symFree_how: '+20 par jour calme',
    colony_row_meals: 'Repas pauvres en FODMAP', colony_row_meals_how: '+5 par repas sûr (max 3/jour)',
    colony_row_logging: 'Journal quotidien', colony_row_logging_how: '+10 pour noter quelque chose ce jour-là',
    colony_row_reintro: 'Tests de réintroduction', colony_row_reintro_how: '+50 par test complété',
    colony_footer: 'Flora grandit avec tes habitudes digestives. Les jours difficiles ne te coûtent pas de points — c\'est la régularité qui compte.',
    levelup_badge_complete: '🎉 COLONIE COMPLÈTE',
    levelup_title_complete: 'Une colonie complète et florissante !',
    levelup_body_complete: 'Tu as cultivé les 12 microbes — une communauté intestinale diverse et saine. Maintenant, fais-la prospérer.',
    levelup_badge: 'NIVEAU SUPÉRIEUR',
    levelup_title: 'Niveau {n}',
    levelup_body: 'Flora est maintenant {form} ! Tes bonnes habitudes portent leurs fruits.',
    levelup_member_badge: 'NOUVEAU MEMBRE DE LA COLONIE',
    levelup_member_body: 'Un nouveau microbe a rejoint la colonie de Flora — tes bonnes habitudes portent leurs fruits.',
    levelup_btn: 'Super !',
    lf_meal_low_title: 'Bon choix !', lf_meal_low_msg: 'Ce repas est doux pour ton intestin. Flora approuve.',
    lf_meal_mod_title: 'Repas modéré', lf_meal_mod_msg: 'Ok en petites portions — surveille l\'accumulation aujourd\'hui.',
    lf_meal_high_title: 'Repas riche en FODMAP', lf_meal_high_msg: 'Celui-là pourrait agiter les choses. Observe comment tu te sens après.',
    lf_symptom_high_title: 'Courage', lf_symptom_high_msg: 'Désolé(e) que tu ne te sentes pas bien. Le noter aide à trouver la cause.',
    lf_symptom_low_title: 'Noté', lf_symptom_low_msg: 'C\'est enregistré. Ça va sûrement passer.',
    lf_sleep_great_title: 'Bien reposé(e) !', lf_sleep_great_msg: 'Un bon sommeil aide ton intestin à récupérer. Bravo.',
    lf_sleep_ok_title: 'Nuit correcte', lf_sleep_ok_msg: 'Repos décent — un peu plus ferait du bien à ton intestin.',
    lf_sleep_short_title: 'Nuit courte', lf_sleep_short_msg: 'Peu de sommeil peut amplifier les symptômes. Sois doux(ce) avec toi aujourd\'hui.',
    lf_stress_low_title: 'Belle sérénité', lf_stress_low_msg: 'Peu de stress, c\'est super pour l\'intestin. Continue ainsi.',
    lf_stress_mid_title: 'Gérable', lf_stress_mid_msg: 'Une journée ordinaire — quelques respirations profondes peuvent aider.',
    lf_stress_high_title: 'Beaucoup de stress', lf_stress_high_msg: 'Le stress et l\'intestin sont liés. Essaie de décompresser un peu.',
    lf_got_it: 'Compris',
    progress_title: 'Mes progrès',
    progress_last7: '7 DERNIERS JOURS',
    progress_gut_score: 'score intestinal',
    progress_calm_days: 'Jours calmes',
    progress_adherence: 'Adhérence',
    progress_avg_sleep: 'Sommeil moy.',
    progress_adherence_title: 'Adhérence FODMAP',
    progress_adherence_sub: 'Part des repas avec des aliments sûrs',
    progress_symptoms_title: 'Symptômes',
    progress_symptoms_sub: 'Moins c\'est mieux',
    progress_symptoms_this_week: '{n} cette semaine',
    progress_sleep_title: 'Sommeil',
    progress_sleep_sub: 'Heures par nuit',
    progress_sleep_avg: 'moy. {n}h',
    progress_avg_water: 'Eau moy.',
    progress_water_title: 'Eau',
    progress_water_sub: 'Verres par jour',
    progress_water_avg: 'moy. {n}',
    progress_score_null: 'Continue à noter pour voir ton score hebdomadaire',
    progress_score_good: 'Ton intestin a eu une semaine calme et stable',
    progress_score_mid: 'Une semaine mitigée — quelques choses à observer',
    progress_score_bad: 'Une semaine difficile — sois indulgent(e) avec toi',
    progress_flora_body: 'Flora grandit avec tes habitudes de la semaine.',
    log_chooser_title: 'Qu\'est-ce que tu veux noter ?',
    log_meal_sub: 'Cherche des aliments, scanne ou utilise l\'IA',
    log_symptom_sub: 'Comment tu te sens',
    log_sleep_sub: 'Enregistrer les heures',
    log_stress_sub: 'Capturer le niveau de stress',
    nudge_lifestyle: 'Ajoute aussi sommeil, stress et eau — ça affine tes tendances.',
    sleep_title: 'Noter le sommeil',
    sleep_hours_label: 'Heures dormies : {n}h',
    stress_title: 'Noter le stress',
    stress_label: 'Stress : {label}',
    stress_calm: 'Calme', stress_mild: 'Léger', stress_manageable: 'Gérable',
    stress_tense: 'Tendu(e)', stress_overwhelmed: 'Débordé(e)',
    symptom_title: 'Noter un symptôme',
    symptom_q: 'Comment tu te sens ?',
    symptom_intensity: 'Intensité ({n}/5)',
    symptom_log_btn: 'Noter',
    symptom_bloating: 'Ballonnements', symptom_pain: 'Douleur', symptom_gas: 'Gaz',
    symptom_diarrhea: 'Diarrhée', symptom_constipation: 'Constipation', symptom_nausea: 'Nausée',
    paywall_headline_default: 'Débloque le parcours GutBloom complet',
    paywall_sub_default: 'Premium te donne tout ce qu\'il faut pour le parcours complet d\'élimination à réintroduction.',
    paywall_headline_reintro: 'Débloque ta réintroduction complète',
    paywall_sub_reintro: 'Tu as terminé ton premier défi alimentaire. Premium débloque les cinq groupes FODMAP restants — la partie qui te donne ta liste personnelle d\'aliments sûrs.',
    paywall_headline_recipes: 'Débloque plus de 50 recettes',
    paywall_sub_recipes: 'Tu as exploré les recettes gratuites. Premium ouvre la bibliothèque complète de repas sûrs pour l\'élimination, toutes cuisines confondues.',
    paywall_headline_history: 'Vois ton historique complet de tendances',
    paywall_sub_history: 'La version gratuite montre cette semaine. Premium garde ton historique complet pour observer les tendances sur des mois.',
    paywall_headline_export: 'Exporte tes données pour ton médecin',
    paywall_sub_export: 'Génère un PDF clair de tes symptômes, déclencheurs et progrès à partager avec ton médecin ou diététicien(ne).',
    paywall_headline_scan: 'Le scan de repas par IA est une fonctionnalité Premium',
    paywall_sub_scan: 'Prends en photo un repas pour une estimation FODMAP rapide. Premium inclut 30 scans par mois. La recherche d\'aliments et le scan de codes-barres restent gratuits.',
    paywall_feat_reintro: 'Réintroduction complète', paywall_feat_reintro_sub: 'Teste les 6 groupes FODMAP, pas seulement le premier',
    paywall_feat_recipes: 'Plus de 50 recettes', paywall_feat_recipes_sub: 'Chaque repas sûr, toutes cuisines',
    paywall_feat_scan: 'Ta carte FODMAP personnelle', paywall_feat_scan_sub: 'Découvre exactement quels aliments et quelles portions te conviennent',
    paywall_feat_history: 'Historique complet de tendances', paywall_feat_history_sub: 'Vois les tendances sur des mois, pas seulement cette semaine',
    paywall_feat_export: 'Export médecin', paywall_feat_export_sub: 'Un PDF clair de tes données pour les consultations',
    paywall_free_note: 'La recherche d\'aliments, le scan de codes-barres, les journaux, GutGuide et la phase d\'élimination complète restent gratuits — toujours. Premium débloque la réintroduction et tout ce qui suit.',
    paywall_best_badge: 'IDÉAL POUR LE PARCOURS',
    paywall_trial_note: '{price}. Résilie quand tu veux. Aucune pub, jamais.',
    paywall_trial_btn: 'Obtenir Premium',
    paywall_annual_price: '69 €/an · environ 5,75 €/mois',
    paywall_monthly_price: '8,99 €/mois',
    annual: 'Annuel', monthly: 'Mensuel',
    settings_title: 'Réglages',
    settings_premium_active_sub: 'Ton parcours complet est débloqué. Merci pour ton soutien.',
    settings_mid_journey: 'Déjà en cours de parcours ? Mets à jour ta phase manuellement.',
    settings_current_phase: 'Phase actuelle',
    settings_phase_not_started: 'Pas encore commencé',
    settings_phase_elimination: 'Élimination',
    settings_phase_reintroduction: 'Réintroduction',
    settings_week_label: 'Déjà à la semaine n°',
    settings_week_sub: 'On ajustera ta date de départ en conséquence.',
    settings_menstruate_q: 'As-tu des règles ?',
    settings_menstruate_sub: 'Si oui, on affiche un suivi des règles sur l\'accueil pour repérer les tendances hormonales.',
    settings_other_intolerances: 'Autres intolérances', settings_none: 'Aucune',
    settings_other_intolerances_sub: 'On signalera les aliments pauvres en FODMAP mais problématiques pour ces intolérances.',
    settings_doctor_summary: 'Résumé pour le médecin', settings_doctor_export_btn: 'Exporter le résumé pour le médecin',
    settings_doctor_sub: 'Exporte tes données en résumé à partager avec ton médecin ou diététicien(ne).',
    settings_save_phase: 'Enregistrer les changements de phase',
    settings_custom_foods: 'Tes aliments personnalisés', settings_custom_foods_sub: 'Aliments que tu as ajoutés. Touche un point pour changer le niveau FODMAP, ou ✕ pour supprimer.',
    settings_start_over: 'Recommencer à zéro',
    settings_start_over_sub: 'Efface toutes tes données — profil, journaux et progrès — et relance l\'intégration. Impossible à annuler.',
    settings_reset_confirm: 'Oui, tout effacer',
    settings_reset_btn: 'Réinitialiser l\'app',
    settings_disclaimer_title: 'Avertissement santé',
    settings_disclaimer_body: 'GutBloom est un outil de bien-être et de suivi — pas un dispositif médical, et pas un substitut aux conseils, diagnostics ou traitements médicaux professionnels. Il ne diagnostique pas les maladies et ne remplace pas ton médecin. En cas de doute médical, consulte toujours un professionnel de santé. Le parcours low-FODMAP est plus efficace avec un diagnostic de SII et l\'accompagnement d\'un(e) diététicien(ne) formé(e) au FODMAP. Si tu as des symptômes graves ou inquiétants, contacte un professionnel médical.',
    settings_terms: 'Conditions d\'utilisation', settings_privacy: 'Politique de confidentialité',
    plan_sub: 'Ton parcours FODMAP en deux phases',
    plan_period_pause: 'Envisage une pause',
    plan_period_pause_sub: 'Les règles peuvent amplifier les symptômes de 30–40 %.',
    plan_phase1_eyebrow: 'PHASE 1', plan_phase1_title: 'Élimination',
    plan_phase1_body: 'On fait une pause temporaire avec les aliments déclencheurs courants pour calmer l\'intestin et créer une base de référence claire — pour que les réactions soient plus faciles à repérer ensuite.',
    plan_elim_in_progress: 'En cours — vois les aliments en pause sur ton écran d\'accueil',
    plan_elim_done: 'Terminé — ton intestin a eu le temps de se calmer',
    plan_phase2_eyebrow: 'PHASE 2', plan_phase2_title: 'Réintroduction',
    plan_phase2_body: 'Un aliment à la fois, on les réintroduit et on observe comment ton corps réagit — pour découvrir tes vrais déclencheurs tout en élargissant ton alimentation en toute sécurité.',
    plan_reintro_locked: 'Se débloque après l\'élimination',
    plan_start_reintro: 'Démarrer la phase de réintroduction',
    plan_status_current: 'ACTUEL', plan_status_completed: 'COMPLÉTÉ', plan_status_upcoming: 'À VENIR',
    plan_what_now: 'QUOI FAIRE MAINTENANT',
    plan_categories: 'Catégories ({n}/6 complétées)',
    plan_tolerated: 'Toléré', plan_trigger: 'Déclencheur identifié',
    plan_in_progress: 'En cours', plan_premium_tap: 'Premium — touche pour débloquer',
    plan_tap_start: 'Touche pour commencer', plan_locked_until: 'Bloqué jusqu\'à ce que tu sois prêt(e)',
    plan_continue_reintro_title: '🌱 Continue ta réintroduction',
    plan_continue_reintro_body: 'Tu as terminé ton premier défi alimentaire. Premium débloque les cinq restants — la partie qui construit ta liste personnelle d\'aliments sûrs.',
    plan_disclaimer: 'Ce plan est une orientation générale, pas un conseil médical. Le régime pauvre en FODMAP fonctionne mieux avec un diagnostic de SII et un(e) diététicien(ne) formé(e). Arrête et consulte si les symptômes sont sévères.',
    test_active_badge: 'TEST ACTIF - JOUR {day} SUR 3',
    test_portion: 'Portion du jour : {portion}',
    test_no_reaction: 'Pas de réaction', test_reacted: 'Réaction',
    test_day_logged_next: 'Jour {day} noté. Reviens demain pour la portion {portion}.',
    test_day_logged_done: 'Jour {day} noté. Test terminé !',
    test_cancel: 'Annuler le test',
    test_modal_title: 'Tester {name}',
    test_protocol_badge: 'Protocole Monash 3 jours',
    test_protocol_body: 'Jour 1 : petite portion — Jour 2 : moyenne — Jour 3 : grande\nSi tu réagis un jour, le test s\'arrête tôt. Après 3 jours, repos {rest} jours avant la catégorie suivante.',
    test_pick_food: 'Choisis un aliment à tester',
    test_day_portions: 'Jour 1 : {s} — Jour 2 : {m} — Jour 3 : {l}',
    test_start_btn: 'Démarrer le test 3 jours',
    test_badge: 'TEST RÉINTRO',
    test_count_q: 'Compter ceci comme le test d\'aujourd\'hui ?',
    test_logged_q: 'Tu as noté {food} qui fait partie de ta réintroduction de {cat}. As-tu eu une réaction ?',
    test_how_bad: 'À quel point ? ({n}/5)',
    test_save_btn: 'Enregistrer le résultat du test',
    test_skip_link: 'Ignorer — pas dans le cadre du test',
    toast_elim_started: 'Phase d\'élimination démarrée',
    toast_reintro_started: 'Phase de réintroduction démarrée',
    toast_updated: 'Entrée mise à jour',
    toast_deleted: 'Entrée supprimée',
    toast_test_cancelled: 'Test annulé',
    toast_test_started: 'Test démarré',
    toast_test_tolerated: 'Test terminé — toléré !',
    toast_test_complete: 'Test terminé',
    toast_day_logged: 'Jour {n} consigné',
    toast_product_logged: '{name} consigné',
    toast_ai_logged: 'Scan IA enregistré',
    toast_welcome_premium: 'Bienvenue dans Premium — ton parcours complet est débloqué',
    toast_diagnosed: 'Merci — ça nous aide à adapter ton plan',
    toast_period_started: 'Règles commencées',
    toast_period_ended: 'Règles terminées',
    edit_title: 'Modifier l\'entrée',
    edit_foods_label: 'Aliments (lecture seule)',
    edit_portion: 'Portion',
    edit_portion_s: 'Petite', edit_portion_m: 'Moyenne', edit_portion_l: 'Grande',
    portion_or_less: 'ou moins', portion_or_more: 'ou plus',
    unit_piece_one: 'pièce', unit_piece_other: 'pièces', unit_slice_one: 'tranche', unit_slice_other: 'tranches',
    meal_portion_hint: 'Choisis la portion de chaque ingrédient. Les tailles sont adaptées à chaque aliment, M étant une portion typique.',
    meal_dish_contains: 'Contient',
    edit_hours_label: 'Heures : {n}h',
    edit_intensity_label: 'Intensité ({n}/5)',
    edit_stress_label: 'Niveau de stress : {n}/5',
    edit_save_btn: 'Enregistrer les modifications',
    edit_log_again: 'Réenregistrer maintenant',
    edit_log_again_hint: 'Ajoute ces aliments comme nouvelle entrée, à l\'heure actuelle — celle-ci ne change pas',
    edit_delete_btn: 'Supprimer l\'entrée',
    barcode_title: 'Scanner le code-barres',
    barcode_point: 'Pointe vers un code-barres',
    barcode_cam_needed: 'Permission caméra requise',
    barcode_allow: 'Autoriser',
    barcode_looking: 'Recherche en cours',
    barcode_found: 'TROUVÉ',
    barcode_risk: 'RISQUE FODMAP',
    barcode_high: 'Risque élevé', barcode_low: 'Probablement sûr',
    barcode_ingredients: 'INGRÉDIENTS',
    barcode_scan_another: 'Scanner un autre',
    barcode_add: 'Ajouter au journal',
    risk_low: 'Faible', risk_moderate: 'Modéré', risk_high: 'Élevé',
    list_fermented: 'FERMENTÉ', list_tolerated: 'toléré', list_trigger: 'déclencheur',
    hist_high: 'ÉLEVÉ', hist_mod: 'MODÉRÉ', hist_liberator: 'LIBÉRATEUR',
    pill_day: 'Jour {n}', detail_ferm_tag: 'FERMENTATION', app_tagline: 'Ton intestin entre de bonnes mains',
    form_seedling: 'Graine', form_sprout: 'Pousse', form_growing: 'En croissance',
    form_blooming: 'En fleur', form_thriving: 'Épanouie',

    // Meal modal
    meal_modal_title: 'Consigner un repas',
    meal_discard_title: 'Supprimer ce repas ?',
    meal_discard_body: 'Il n’a pas encore été enregistré — tes aliments sélectionnés seront perdus.',
    meal_discard_keep: 'Continuer',
    meal_discard_confirm: 'Supprimer',
    meal_modal_search_ph: 'Rechercher un aliment',
    meal_modal_scan_btn: 'Scanner un code-barres',
    barcode_intro_title: 'Scanner un code-barres',
    barcode_intro_body: 'Pointez l’appareil photo vers le code-barres d’un produit emballé : GutBloom le recherche et affiche son risque FODMAP probable ainsi que les ingrédients déclencheurs, pour décider avant de manger.',
    barcode_intro_cta: 'Scanner maintenant',
    barcode_intro_later: 'Plus tard',
    meal_modal_your_meal: 'Votre repas',
    meal_edit_portion_of: 'Modifier la portion : {food}', meal_remove_item: 'Retirer du repas', meal_dish_remove_hint: 'Touche un ingrédient pour le retirer', meal_dish_add_hint: 'Mangé avec des extras (sauce, dip ou accompagnement) ? Ajoute-les via la recherche sur l’écran du repas.', meal_ingredient_removed: 'retiré',
    meal_base_hint: "C'est une base — ajoute les autres ingrédients que tu as utilisés (fromage, légumes, garnitures…) pour que le score corresponde à ton assiette.",
    meal_modal_hist_alert: 'Alerte histamine',
    meal_modal_high_hist: 'Histamine élevée : {foods}.',
    meal_modal_hist_lib: 'Libérateurs d\'histamine : {foods}.',
    meal_modal_hist_note: 'Ce repas peut être pauvre en FODMAP mais rester problématique pour vous.',
    meal_modal_results: 'Résultats',
    meal_modal_recent: 'Aliments récents',
    meal_modal_recent_meals: 'Repas récents',
    meal_type_label: 'Type', meal_type_breakfast: 'Petit-déj', meal_type_lunch: 'Déjeuner', meal_type_dinner: 'Dîner', meal_type_snack: 'Encas',
    meal_my_breakfast: 'Mon petit-déj', meal_my_lunch: 'Mon déjeuner', meal_my_dinner: 'Mon dîner', meal_my_snack: 'Mon encas',
    edit_dish: 'Plat', meal_edit_extras: 'Ingrédients ajoutés', meal_edit_foods: 'Aliments', meal_edit_add: 'Ajouter un aliment', meal_edit_none: 'Aucun aliment — ajoutes-en au moins un.', edit_now_custom: 'Tu as modifié les ingrédients — c’est maintenant un repas personnalisé.',
    meal_custom_q: '"{name}" introuvable ?',
    meal_custom_tip: 'Conseil : si c\'est un mélange (comme une ratatouille), ajoute plutôt les ingrédients individuels — tu obtiendras des verdicts plus précis.',
    meal_custom_add: 'Choisis son niveau FODMAP :',
    meal_custom_low_desc: 'riz, viande, œufs, carottes, pommes de terre, cheddar, fraises',
    meal_custom_mod_desc: 'avoine, pâtes, lait de vache, champignons, pois chiches',
    meal_custom_high_desc: 'ail, oignon, blé, légumineuses, miel, fruits à noyau',
    meal_modal_pick: 'Choisissez des aliments pour consigner votre repas',
    meal_modal_items_one: '{n} aliment', meal_modal_items: '{n} aliments',
    meal_low: 'Faible en FODMAP', meal_moderate: 'Modéré', meal_high: 'Élevé en FODMAP',
    meal_reason_from: 'à cause de {food}', meal_reason_stack: 'FODMAP modérés qui s\'accumulent',
    meal_why_label: 'Pourquoi',
    meal_swap_tip: 'Remplace {food} → {alt}',
  },
  it: {
    // Account / authentication
    account: 'Account', account_sub: 'Accedi per salvare e sincronizzare il tuo percorso su tutti i dispositivi.',
    account_signed_in: 'Accesso eseguito', account_manage: 'Gestisci account',
    sign_in: 'Accedi', sign_up: 'Crea account', sign_out: 'Esci',
    auth_title_login: 'Bentornato', auth_title_signup: 'Crea il tuo account', auth_title_reset: 'Reimposta password',
    auth_sub_login: 'Accedi per sincronizzare il tuo percorso su tutti i dispositivi.',
    auth_sub_signup: 'I tuoi dati restano tuoi — un account li salva e li mantiene sincronizzati.',
    auth_sub_reset: 'Inserisci la tua email e ti invieremo un link per reimpostarla.',
    auth_email: 'Email', auth_email_ph: 'tu@esempio.com',
    auth_password: 'Password', auth_password_ph: 'Almeno 6 caratteri',
    auth_forgot: 'Password dimenticata?',
    auth_to_signup: 'Nuovo qui? Crea un account', auth_to_login: 'Hai già un account? Accedi',
    auth_send_reset: 'Invia link', auth_back_to_login: 'Torna all\'accesso',
    auth_err_empty: 'Inserisci email e password.',
    auth_err_email: 'Inserisci un indirizzo email valido.',
    auth_err_password_short: 'La password deve avere almeno 6 caratteri.',
    auth_err_generic: 'Qualcosa è andato storto. Riprova.',
    auth_err_credentials: 'Email o password errati.',
    auth_err_exists: 'Questa email è già registrata: accedi.',
    auth_err_send: "Non siamo riusciti a inviare l'email di conferma. Controlla l'indirizzo o riprova tra poco.",
    auth_err_unconfirmed: 'Conferma prima la tua email — controlla la posta in arrivo.',
    auth_err_mismatch: 'Le password non coincidono.',
    auth_confirm_password: 'Conferma password', auth_confirm_password_ph: 'Reinserisci la password',
    auth_show_password: 'Mostra password', auth_hide_password: 'Nascondi password',
    auth_sent_title: 'Controlla la tua email', auth_sent_body: 'Abbiamo inviato un link di conferma a {email}. Aprilo per attivare il tuo account, poi accedi.',
    auth_reset_sent_body: 'Se {email} ha un account, il link per reimpostare la password è in arrivo. Aprilo per scegliere una nuova password.',
    account_nudge_title: 'Salva i tuoi progressi', account_nudge_sub: 'Crea un account gratuito per salvare il tuo diario e la tua colonia.', account_nudge_cta: 'Crea account gratuito', account_nudge_row_sub: 'Salva diario e colonia',
    levelup_save_cta: 'Salva la tua colonia — crea un account gratuito',
    sync_now: 'Sincronizza ora', sync_syncing: 'Sincronizzazione…', sync_last: 'Ultima sincronizzazione {time}', sync_never: 'Non ancora sincronizzato', sync_failed: 'Sincronizzazione non riuscita — riproveremo.',
    account_sync_sub: 'I tuoi diari e alimenti personalizzati vengono salvati e sincronizzati automaticamente.',
    auth_check_email: 'Ci siamo quasi! Controlla la tua email per confermare l\'account, poi accedi.',
    auth_reset_sent: 'Se questa email è registrata, il link è in arrivo.',
    auth_signed_out: 'Disconnesso.', auth_welcome_toast: 'Accesso eseguito. Bentornato! 🌱',
    auth_linked_note: 'I tuoi dati esistenti sono ora collegati al tuo account.',
    sync_now: 'Sincronizza ora', sync_syncing: 'Sincronizzazione…', sync_last: 'Ultima sincronizzazione {time}', sync_never: 'Non ancora sincronizzato', sync_failed: 'Sincronizzazione non riuscita — riproveremo.',
    account_sync_sub: 'Le tue voci e gli alimenti personalizzati vengono salvati e sincronizzati automaticamente.',
    continue: 'Continua', back: 'Indietro', save: 'Salva', close: 'Chiudi', gotIt: 'Ho capito', a11y_clear: 'Cancella ricerca', a11y_remove: 'Rimuovi', a11y_add_log: 'Aggiungi voce',
    cancel: 'Annulla', done: 'Fatto', skip: 'Salta',
    tab_home: 'Oggi', tab_foods: 'Alimenti', tab_plan: 'Il mio piano', tab_guide: 'GutGuide',
    onb_name_q: 'Come ti chiami?', onb_name_sub: 'Basta il nome.', onb_name_ph: 'Il tuo nome',
    onb_safety_q: 'Prima di iniziare', onb_safety_sub: 'Un rapido controllo di salute — è importante.',
    onb_start: 'Inizia GutBloom',
    home_greeting: 'Ciao',
    home_patterns: 'I miei schemi', home_todays_meals: 'Pasti di oggi',
    foods_title: 'Esplora alimenti', foods_sub: 'Cerca un alimento, vedi i fattori scatenanti e le porzioni sicure',
    foods_search: 'Cerca un alimento', foods_count: '{n} alimenti',
    foods_no_results: 'Nessun alimento corrisponde a questi filtri.', foods_clear_filters: 'Azzera filtri',
    filter_all: 'Tutti', filter_dishes: 'Piatti', filter_high: 'Alto', filter_mod: 'Moderato', filter_low: 'Basso',
    filter_category: 'Categoria', cat_modal_title: 'Filtra per categoria', cat_modal_clear: 'Azzera', cat_modal_done: 'Mostra {n} alimenti',
    grp_fruit: 'Frutta', grp_veg: 'Verdura', grp_dairy: 'Latticini', grp_protein: 'Proteine', grp_grain: 'Cereali', grp_drink: 'Bevande', grp_nut: 'Frutta secca', grp_sauce: 'Salse', grp_sweet: 'Dolci', grp_legume: 'Legumi',
    plan_title: 'Il mio piano',
    guide_title: 'GutGuide', guide_sub: '50 risposte oneste alle domande comuni sui FODMAP',
    guide_search: 'Cerca una domanda',
    log_meal: 'Registra pasto', log_symptom: 'Registra sintomo', log_sleep: 'Registra sonno', log_stress: 'Registra stress',
    log_water: 'Registra acqua', log_water_sub: 'Monitora l’idratazione', water_title: 'Acqua', water_amount_label: 'Quanti bicchieri hai bevuto?', water_glasses_one: '{n} bicchiere', water_glasses: '{n} bicchieri', water_unit_hint: '1 bicchiere ≈ 200 ml', water_why_title: 'Perché l’idratazione è importante', water_why: 'Bere a sufficienza aiuta la digestione e mantiene le feci morbide — previene stitichezza e gonfiore, comuni nell’IBS, soprattutto quando aumenti le fibre.', lf_water_title: 'Ottimo', lf_water_msg: 'Ogni bicchiere aiuta il tuo intestino a restare in movimento.', lf_water_goal_title: 'Obiettivo idratazione raggiunto!', lf_water_goal_msg: 'Tutti i {goal} bicchieri — circa {liters} L oggi. Il tuo intestino ringrazia.', edit_water_label: 'Bicchieri', water_progress: '{n} / {goal} bicchieri · ≈ {liters} L', water_goal_reached: 'Obiettivo raggiunto, ottima idratazione!',
    settings: 'Impostazioni', upgrade: 'Passa a Premium', premium_active: 'GutBloom Premium',
    paywall_cta: 'Ottieni Premium', plan_annual: 'Annuale', plan_monthly: 'Mensile',
    save_meal: 'Salva pasto', doctor_summary: 'Riepilogo per il medico',
    lang_label: 'Lingua', lang_auto: 'Automatica (lingua del telefono)',
    foods_src_note: "Le indicazioni sugli alimenti si basano su principi consolidati della dieta low-FODMAP come guida generale, non sono valori testati in laboratorio. L'app FODMAP della Monash University è il riferimento clinico per le soglie precise.",
    detail_trigger_head: 'Con che frequenza causa disturbi', detail_portion_head: 'Indicazioni sulle porzioni',
    detail_swap_head: 'Mangia questo invece', detail_why_head: 'Perché causa disturbi',
    detail_swap_sub: 'Non devi rinunciare al gusto — queste alternative low-FODMAP fanno lo stesso lavoro.',
    detail_lighten_head: 'Come renderlo low-FODMAP', detail_lighten_sub: 'Piccoli accorgimenti che riducono i FODMAP — stesso gusto, più leggero per l\'intestino.',
    detail_tolerate: 'LO TOLLERI', detail_trigger: 'QUESTO TI SCATENA DISTURBI',
    detail_cross_warn: 'Avvertimento di intolleranza incrociata',
    detail_hist_high: 'Ricco di istamina — probabilmente problematico se reagisci ad alimenti stagionati o fermentati.',
    fermented_tolerance_note: 'Fermentato — spesso tollerato meglio dei latticini normali',
    small_portion_note: 'OK in piccola porzione (circa 40 g)',
    food_base_note: 'Ricetta base — aggiungi i tuoi ingredienti',
    detail_hist_mod: 'Istamina moderata — di solito tollerata in piccole porzioni.',
    detail_hist_lib: 'Liberatore di istamina — non contiene istamina ma può spingere il corpo a produrla.',
    detail_profile_note: 'In base al tuo profilo. Modifica nelle Impostazioni.',
    detail_portion_safe: 'Sicuro in qualsiasi quantità',
    detail_portion_low_then: 'Basso fino a {g}g, poi moderato',
    detail_portion_low: 'Fino a {g}g — Basso in FODMAP',
    detail_portion_mod: '{lo}–{hi}g — Moderato',
    detail_portion_high_label: 'Oltre {g}g — Alto',
    detail_portion_high_note: 'Alto in FODMAP in qualsiasi quantità. Da evitare durante l\'eliminazione.',
    detail_ferm_good: 'UTILE SAPERE', detail_ferm_caution: 'ATTENZIONE', detail_ferm_mixed: 'QUADRO MISTO',
    detail_trigger_note: 'Una guida generale per le persone con IBS. La tua tolleranza personale è ciò che conta — la fase di reintroduzione te lo mostrerà.',
    band_common: 'Spesso un fattore scatenante', band_sometimes: 'A volte un fattore scatenante', band_rarely: 'Raramente un fattore scatenante',
    band_common_s: 'Spesso', band_sometimes_s: 'A volte', band_rarely_s: 'Raramente',
    recipes_title: 'Ricette',
    recipes_flora_sub: 'Pasti amici dell\'intestino che Flora ama cucinare',
    recipes_upsell_headline: 'Cucina senza limiti',
    recipes_upsell_sub: 'Hai provato {free} di {total} ricette — ecco tutto il resto.',
    recipes_upsell_bullet1: 'Tutte le {n} ricette amiche dell\'intestino',
    recipes_upsell_bullet2: 'Piano completo di reintroduzione passo dopo passo',
    recipes_upsell_bullet3: 'Esportazione dati pronta per il medico',
    recipes_unlock_btn: 'Sblocca Premium',
    recipe_premium_locked: 'Ricetta Premium — tocca per sbloccare',
    recipe_meta: '{meal} · {min} min · {ing} ingredienti',
    recipe_badge_safe: 'SICURO IN ELIMINAZIONE',
    recipe_ingredients: 'Ingredienti',
    recipe_steps: 'Passaggi',
    recipe_log_btn: 'Registra come pasto',
    meal_breakfast: 'Colazione', meal_lunch: 'Pranzo', meal_dinner: 'Cena', meal_snack: 'Spuntino',
    guide_count: '{n} domande', guide_no_results: 'Nessuna domanda corrisponde alla ricerca. Prova un\'altra parola o argomento.',
    guide_flora_title: 'Curiosità sui FODMAP?',
    guide_flora_sub: 'Flora ha risposte oneste e chiare alle domande più frequenti.',
    scan_limit_title: 'Scansioni mensili esaurite',
    scan_limit_body: 'Hai utilizzato tutte le {n} scansioni IA di questo mese. Il tuo limite si azzera all\'inizio del mese prossimo. Nel frattempo puoi continuare a registrare pasti tramite ricerca o codice a barre — entrambi senza limite.',
    paywall_includes: 'Cosa include Premium',
    pattern_watch: 'Da osservare', pattern_noticed: 'Notato', pattern_good: 'Buon segno',
    patterns_empty: 'Continua a registrare i pasti e come ti senti. Gli schemi emergono di solito dopo circa una settimana.',
    export_share: 'Condividi riepilogo',
    export_share_again: 'Condividi di nuovo',
    export_modal_title: 'Riepilogo per il medico',
    export_appt_title: 'Un riepilogo per il tuo appuntamento',
    export_appt_body: 'Questo raccoglie i tuoi dati registrati, i risultati della reintroduzione e i pattern osservati in un riepilogo che puoi inviare al tuo medico o dietista. Tocca Condividi per inviarlo tramite e-mail, messaggistica o salvarlo come nota.',
    export_preview_label: 'Anteprima',
    export_shared: 'Condiviso!',
    export_shared_note: 'Riepilogo condiviso. Puoi inviarlo di nuovo in qualsiasi momento.',
    export_disclaimer: 'Questo riflette dati auto-dichiarati e integra — senza sostituire — la valutazione medica professionale.',
    recipe_how_to: 'Come prepararlo',
    recipe_log_full_btn: 'L\'ho preparato · Registra come pasto',
    recipe_portions_note: 'Le porzioni sono indicative. Consulta l\'Esplora alimenti per i limiti sicuri degli ingredienti moderatamente FODMAP.',
    settings_premium_sub: 'Reintroduzione completa, tutte le ricette, esportazione per il medico. Nessuna pubblicità, mai.',

    safety_ibs_q: 'Ti è stato diagnosticato il colon irritabile (IBS) da un medico?',
    safety_yes: 'Sì', safety_no: 'No', safety_unsure: 'Non sono sicuro/a',
    safety_no_diag_note: 'La dieta low-FODMAP è progettata come strumento dopo una diagnosi di IBS. Gli stessi sintomi possono derivare da altre condizioni che richiedono un trattamento diverso — meglio consultare prima un medico. Puoi comunque esplorare GutBloom per imparare.',
    safety_flags_q: 'Stai riscontrando uno di questi sintomi?',
    safety_flags_sub: 'Spunta tutto ciò che si applica. Lascia vuoto se nessuno.',
    safety_flag_blood: 'Sangue nelle feci',
    safety_flag_weightloss: 'Perdita di peso inspiegabile',
    safety_flag_newover50: 'Sintomi intestinali nuovi comparsi dopo i 50 anni',
    safety_flag_famhistory: 'Familiarità con cancro al colon, celiachia o MICI',
    safety_flag_anemia: 'Anemia o ferro basso',
    safety_flag_fever: 'Febbre insieme ai sintomi intestinali',
    safety_flag_nightwake: 'Sintomi che ti svegliano di notte',
    safety_warn_title: 'Consulta un medico prima di cambiare la tua dieta',
    safety_warn_body: 'Alcuni dei sintomi che hai indicato sono quelli che i medici chiamano "segnali d\'allarme". Non significa che ci sia qualcosa di grave — ma dovresti essere valutato/a prima di iniziare una dieta restrittiva, perché i cambiamenti alimentari possono mascherare qualcosa che richiede attenzione.',
    safety_warn_ack: 'Ho capito e ho deciso di continuare.',
    onb_step: 'Passo {n} di {total}',
    onb_flora_intro: 'Ciao, sono Flora — la tua amica intestinale',
    onb_ibs_q: 'Cos\'è l\'IBS?',
    onb_ibs_card1_title: 'Una condizione molto comune',
    onb_ibs_card1_body: 'La sindrome dell\'intestino irritabile (IBS) colpisce circa 1 persona su 10 nel mondo. Non è una malattia — è un disturbo funzionale dell\'intestino: l\'intestino è sensibile e reattivo, ma non danneggiato.',
    onb_ibs_card2_title: 'I sintomi',
    onb_ibs_card2_body: 'Gonfiore, crampi, dolore addominale, diarrea, stitichezza — o un mix che cambia giorno per giorno. I sintomi sono reali e possono influenzare notevolmente la vita quotidiana, anche se gli esami spesso risultano normali.',
    onb_ibs_card3_title: 'La buona notizia',
    onb_ibs_card3_body: 'L\'IBS è gestibile. Alimentazione, stress, sonno e la conoscenza dei propri fattori scatenanti fanno una vera differenza. Questo è esattamente ciò che GutBloom ti aiuta a fare.',
    onb_menstruate_q: 'Hai le mestruazioni?',
    onb_menstruate_sub: 'I cicli ormonali possono amplificare i sintomi dell\'IBS del 30–40 %. Se sì, ti aiuteremo a individuare i pattern legati al ciclo. Puoi cambiarlo in qualsiasi momento nelle Impostazioni.',
    onb_menstruate_yes: 'Sì', onb_menstruate_no: 'No',
    onb_fodmap_q: 'Cos\'è il FODMAP?',
    onb_fodmap_card1_title: 'Un gruppo di zuccheri fermentabili',
    onb_fodmap_card1_body: 'FODMAP è l\'acronimo di Oligosaccaridi, Disaccaridi, Monosaccaridi e Polioli Fermentabili — una famiglia di carboidrati a catena corta presenti in molti alimenti quotidiani. Nell\'intestino sensibile vengono mal assorbiti e fermentati dai batteri, causando gas, gonfiore e dolore.',
    onb_fodmap_card2_title: 'La dieta low-FODMAP',
    onb_fodmap_card2_body: 'Sviluppata dalla Monash University, è l\'approccio dietetico più supportato dalle prove scientifiche per l\'IBS. Elimini temporaneamente gli alimenti ad alto contenuto di FODMAP per calmare l\'intestino, poi li reintroduci sistematicamente per trovare i tuoi fattori scatenanti personali.',
    onb_fodmap_card3_title: 'Due fasi, un obiettivo',
    onb_fodmap_card3_body: 'Fase 1 — Eliminazione (~4–6 settimane): eliminare i fattori scatenanti, calmare l\'intestino. Fase 2 — Reintroduzione (~8 settimane): testare ogni gruppo FODMAP per scoprire esattamente quali alimenti ti danno problemi. La maggior parte delle persone finisce con una dieta sorprendentemente varia.',
    onb_phase_q: 'A che punto sei con il FODMAP?',
    onb_phase_sub: 'Ti guidiamo da dove ti trovi.',
    onb_phase_learning: 'Sto solo imparando', onb_phase_curious: 'Sto valutando di provarlo',
    onb_phase_elimination: 'Nella fase di eliminazione', onb_phase_reintro: 'Pronto/a per la reintroduzione',
    onb_phase_maintenance: 'Fasi formali completate',
    onb_symptom_q: 'Sintomo principale?', onb_symptom_sub: 'Tocca quello che ti rappresenta di più.',
    onb_symptom_bloat: 'Gonfiore dopo i pasti', onb_symptom_pain: 'Dolore addominale o crampi',
    onb_symptom_bowel: 'Diarrea o stitichezza', onb_symptom_multi: 'Sintomi multipli',
    onb_known_q: 'Intolleranze note?', onb_known_sub: 'Tocca tutto ciò che si applica. Salta se non sei sicuro/a.',
    onb_known_lactose: 'Lattosio', onb_known_gluten: 'Glutine / Celiachia',
    onb_known_fructose: 'Fruttosio', onb_known_histamine: 'Istamina', onb_known_unknown: 'Non lo so ancora',
    onb_sleep_q: 'Come dormi?', onb_sleep_sub: 'Il sonno influenza i sintomi intestinali più di quanto si pensi.',
    onb_sleep_great: '7–9 ore, ben riposato/a', onb_sleep_okay: '6–7 ore, generalmente bene', onb_sleep_poor: 'Meno di 6 ore o agitato/a',
    onb_stress_q: 'Livello di stress?', onb_stress_sub: 'Stress e intestino vanno di pari passo.',
    onb_stress_low: 'Prevalentemente calmo/a', onb_stress_mid: 'Gestibile', onb_stress_high: 'Molto stress',
    home_empty_title: 'Prendiamoci cura del tuo intestino',
    home_empty_body: 'Registra i pasti e come ti senti, individua i pattern e scopri cosa ama il tuo intestino — un giorno alla volta, con Flora al tuo fianco.',
    home_before_start: 'PRIMA DI INIZIARE',
    home_gp_title: 'Consulta il tuo medico di base o un gastroenterologo',
    home_gp_sub: 'FODMAP è uno strumento da usare dopo una diagnosi di IBS. Tocca per vedere come possono aiutarti.',
    home_gp_confirm: 'Confermare che è IBS — ed escludere altre cause',
    home_gp_confirm_body: 'Sintomi come i tuoi possono derivare anche dalla celiachia o da malattie infiammatorie intestinali. Il tuo medico può eseguire esami iniziali e indirizzarti a uno specialista se necessario.',
    home_diagnosed: 'Sono stato/a dal medico e ho una diagnosi',
    home_how_it_works: 'COME FUNZIONA',
    home_how_intro: 'I sintomi della sindrome dell\'intestino irritabile sono spesso scatenati da certi alimenti, ma i fattori scatenanti sono diversi per ognuno. GutBloom ti guida con un metodo collaudato in due fasi per individuare i tuoi.',
    home_step1_title: 'Registra pasti e come ti senti', home_step1_sub: 'Ricerca rapida, codice a barre o scansione IA',
    home_step2_title: 'Fase di eliminazione', home_step2_sub: 'Per 4–6 settimane mangi cibi semplici e leggeri per l\'intestino che raramente causano disturbi. Questo calma l\'intestino e crea una base chiara e senza sintomi.',
    home_step3_title: 'Fase di reintroduzione', home_step3_sub: 'Reintroduci gli alimenti uno alla volta e osservi come reagisce il tuo corpo: così individui quali sono davvero i tuoi fattori scatenanti e quali sono sicuri.',
    home_step4_title: 'Mangia con serenità', home_step4_sub: 'Crea la tua lista personale di cibi sicuri e fattori scatenanti noti, per goderti i pasti con meno disturbi.',
    home_how_note: 'Basato sull\'approccio a basso contenuto di FODMAP per la sindrome dell\'intestino irritabile. GutBloom ti supporta, ma non è un consiglio medico: consulta il tuo medico o dietista.',
    home_how_more: 'Leggi di più', home_how_less: 'Mostra meno',
    home_start_elim: 'Inizia la fase di eliminazione',
    home_lets_start: 'Iniziamo',
    home_today: 'Oggi', home_yesterday: 'Ieri', home_journal: 'Diario', history_title: 'Cronologia', see_history: 'Vedi tutte le voci', home_see_progress: 'Vedi i miei progressi', patterns_see_all: 'Vedi tutti gli schemi',
    home_hi_name: 'Ciao {name}', home_hi: 'Ciao', home_journey_day: 'Giorno {n} del tuo percorso intestinale', home_eat_well: 'Mangia bene oggi', picker_select_day: 'Scegli un giorno', meal_select_type: 'Scegli un tipo', progress_level_points: 'Livello {level} · {points} punti', a11y_take_photo: 'Scatta una foto', a11y_week_number: 'Numero della settimana', a11y_week_decrease: 'Diminuisci settimana', a11y_week_increase: 'Aumenta settimana', week_number_ph: 'es. 2',
    recipes_all: 'Tutte le ricette', home_meals_sub: '4 pasti sicuri in eliminazione scelti per te. Toccane uno per vederlo.', patterns_empty_early: 'Continua a registrare i pasti e come ti senti. Gli schemi di solito emergono dopo circa una settimana di dati.', patterns_empty_none: 'Ancora nessuno schema chiaro. Continua a registrare: più le voci sono costanti, più le analisi sono precise.', patterns_sub: 'Correlazioni dal tuo diario, non diagnosi. Usale per decidere cosa testare.', patterns_window: 'Ultimi {n} giorni', sev_watch: "DA TENERE D'OCCHIO", sev_maybe: 'SEGNALE INIZIALE', sev_info: 'NOTATO', sev_good: 'BUON SEGNO', show_less: 'Mostra meno', show_more: 'Mostra altri {n}',
    colony_lv: 'Liv. {n} · {form}', colony_pts: '{n} punti', colony_form_spore: 'Spora', colony_form_sprout: 'Germoglio', colony_form_grown: 'Cresciuta', colony_form_thriving: 'Fiorente', colony_level_form: 'Livello {n} · {form}',
    home_low_fodmap: 'Basso in FODMAP', home_symptoms: 'Sintomi', home_sleep: 'Sonno',
    home_colony_title: 'La colonia di Flora', home_see_colony: 'Vedi colonia',
    home_colony_complete: 'Completa',
    home_colony_thriving: 'Colonia completa — vai avanti così!',
    home_days_thriving: '{n} {unit} in fioritura',
    home_day: 'giorno', home_days: 'giorni',
    home_to_level: 'al livello {n}',
    period_turn_on: 'Attiva quando inizia il ciclo',
    period_turn_off: 'Disattiva quando finisce',
    period_active: 'Ciclo attivo', period_tracking: 'Monitoraggio ciclo',
    period_body: 'Gli ormoni possono amplificare i sintomi intestinali del 30–40 % intorno al ciclo. Il monitoraggio aiuta GutBloom a distinguere gli effetti ormonali dai veri fattori scatenanti alimentari.',
    timeline_entries: '{n} voci - tocca per modificare',
    timeline_intensity: 'Intensità {n}/5',
    timeline_stress: 'Livello stress {n}/5',
    timeline_meal_fallback: 'Pasto',
    timeline_extra_one: '+ {n} ingrediente', timeline_extra: '+ {n} ingredienti',
    phase_ready_title: 'Pronto/a per iniziare?',
    phase_ready_body: 'Avvia la fase di eliminazione per identificare i tuoi fattori scatenanti. Dura 4–6 settimane.',
    phase_plan_link: 'Vedi il mio piano',
    phase_elim_badge: 'FASE DI RIPRISTINO · SETTIMANA {n}',
    phase_elim_headline_1: 'Ti stai prendendo cura di te da 1 giorno',
    phase_elim_headline_n: 'Ti stai prendendo cura di te da {n} giorni',
    phase_elim_body_early: 'La maggior parte delle persone nota una vera differenza intorno alla settimana 2–3. Ogni giorno costruisci una base di riferimento più chiara.',
    phase_elim_body_ready: 'Il tuo corpo ha avuto il tempo di calmarsi. Quando sei pronto/a, inizieremo a reintrodurre gli alimenti gradualmente.',
    phase_reintro_badge: 'FASE DI REINTRODUZIONE',
    phase_reintro_headline: 'Settimana {n} di ~{total}',
    phase_reintro_body: 'Un gruppo FODMAP alla volta. Consulta il tuo piano completo nella scheda Il mio piano.',
    mood_null_title: 'Vediamo come va la giornata',
    mood_null_sub: 'Registra un pasto o un sintomo e Flora reagirà.',
    mood_good_title: 'Flora si sente serena oggi',
    mood_good_sub_streak: 'Nessun sintomo da {n} {unit}. Mantieni il ritmo.',
    mood_good_sub: 'Il tuo intestino sta avendo una buona giornata.',
    mood_soso_title: 'Una giornata così così',
    mood_soso_sub: 'Segnali contrastanti oggi — continua a registrare per trovare la causa.',
    mood_bad_title: 'Flora non si sente bene',
    mood_bad_sub: 'Una giornata intestinale difficile. Sii gentile con te stesso/a.',
    colony_title: 'La colonia di Flora',
    colony_thriving: 'Colonia fiorente 🎉',
    colony_points_all: '{n} punti · tutti e 12 i microbi',
    colony_points: '{n} punti · {to} al livello {next}',
    colony_earned: 'Come hai guadagnato i punti',
    colony_row_symFree: 'Giorni senza sintomi', colony_row_symFree_how: '+20 per ogni giorno tranquillo',
    colony_row_meals: 'Pasti low-FODMAP', colony_row_meals_how: '+5 per pasto sicuro (max 3/giorno)',
    colony_row_logging: 'Registrazione quotidiana', colony_row_logging_how: '+10 per aver registrato qualcosa quel giorno',
    colony_row_reintro: 'Test di reintroduzione', colony_row_reintro_how: '+50 per test completato',
    colony_footer: 'Flora cresce con le tue abitudini intestinali. I giorni difficili non ti tolgono punti — è la costanza che conta.',
    levelup_badge_complete: '🎉 COLONIA COMPLETA',
    levelup_title_complete: 'Una colonia completa e fiorente!',
    levelup_body_complete: 'Hai coltivato tutti e 12 i microbi — una comunità intestinale diversificata e sana. Ora mantienila in fioritura.',
    levelup_badge: 'SALTO DI LIVELLO',
    levelup_title: 'Livello {n}',
    levelup_body: 'Flora è ora {form}! Le tue abitudini stanno dando i loro frutti.',
    levelup_member_badge: 'NUOVO MEMBRO DELLA COLONIA',
    levelup_member_body: 'Un nuovo microbo si è unito alla colonia di Flora — le tue abitudini stanno dando i loro frutti.',
    levelup_btn: 'Ottimo!',
    lf_meal_low_title: 'Bella scelta!', lf_meal_low_msg: 'Questo pasto è delicato per il tuo intestino. Flora approva.',
    lf_meal_mod_title: 'Pasto moderato', lf_meal_mod_msg: 'Va bene in porzioni più piccole — attento/a all\'accumulo oggi.',
    lf_meal_high_title: 'Pasto ad alto FODMAP', lf_meal_high_msg: 'Questo potrebbe creare disturbi. Osserva come ti senti dopo.',
    lf_symptom_high_title: 'Tieni duro', lf_symptom_high_msg: 'Mi dispiace che tu non ti senta bene. Registrarlo aiuta a trovare la causa.',
    lf_symptom_low_title: 'Annotato', lf_symptom_low_msg: 'Registrato. Spero passi presto.',
    lf_sleep_great_title: 'Ben riposato/a!', lf_sleep_great_msg: 'Un buon sonno aiuta il tuo intestino a recuperare. Ottimo lavoro.',
    lf_sleep_ok_title: 'Notte accettabile', lf_sleep_ok_msg: 'Riposo decente — un po\' di più farebbe bene al tuo intestino.',
    lf_sleep_short_title: 'Notte corta', lf_sleep_short_msg: 'Poco sonno può amplificare i sintomi. Sii gentile con te oggi.',
    lf_stress_low_title: 'Bella calma', lf_stress_low_msg: 'Poco stress è ottimo per l\'intestino. Continua così.',
    lf_stress_mid_title: 'Gestibile', lf_stress_mid_msg: 'Una giornata nella norma — qualche respiro profondo può aiutare.',
    lf_stress_high_title: 'Molto stress', lf_stress_high_msg: 'Stress e intestino vanno di pari passo. Prova a rilassarti un po\'.',
    lf_got_it: 'Ho capito',
    progress_title: 'I miei progressi',
    progress_last7: 'ULTIMI 7 GIORNI',
    progress_gut_score: 'punteggio intestinale',
    progress_calm_days: 'Giorni tranquilli',
    progress_adherence: 'Aderenza',
    progress_avg_sleep: 'Sonno medio',
    progress_adherence_title: 'Aderenza low-FODMAP',
    progress_adherence_sub: 'Quota di pasti con alimenti sicuri',
    progress_symptoms_title: 'Sintomi',
    progress_symptoms_sub: 'Meno è meglio',
    progress_symptoms_this_week: '{n} questa settimana',
    progress_sleep_title: 'Sonno',
    progress_sleep_sub: 'Ore per notte',
    progress_sleep_avg: 'media {n}h',
    progress_avg_water: 'Acqua media',
    progress_water_title: 'Acqua',
    progress_water_sub: 'Bicchieri al giorno',
    progress_water_avg: 'media {n}',
    progress_score_null: 'Continua a registrare per vedere il tuo punteggio settimanale',
    progress_score_good: 'Il tuo intestino ha avuto una settimana tranquilla e stabile',
    progress_score_mid: 'Una settimana mista — alcune cose da osservare',
    progress_score_bad: 'Una settimana difficile — sii gentile con te stesso/a',
    progress_flora_body: 'Flora cresce con le tue abitudini settimanali.',
    log_chooser_title: 'Cosa vuoi registrare?',
    log_meal_sub: 'Cerca alimenti, scansiona o usa l\'IA',
    log_symptom_sub: 'Come ti senti',
    log_sleep_sub: 'Registra le ore',
    log_stress_sub: 'Cattura il livello di stress',
    nudge_lifestyle: 'Aggiungi anche sonno, stress e acqua: rende i tuoi schemi più precisi.',
    sleep_title: 'Registra sonno',
    sleep_hours_label: 'Ore di sonno: {n}h',
    stress_title: 'Registra stress',
    stress_label: 'Stress: {label}',
    stress_calm: 'Calmo/a', stress_mild: 'Lieve', stress_manageable: 'Gestibile',
    stress_tense: 'Teso/a', stress_overwhelmed: 'Sopraffatto/a',
    symptom_title: 'Registra sintomo',
    symptom_q: 'Come ti senti?',
    symptom_intensity: 'Intensità ({n}/5)',
    symptom_log_btn: 'Registra',
    symptom_bloating: 'Gonfiore', symptom_pain: 'Dolore', symptom_gas: 'Gas',
    symptom_diarrhea: 'Diarrea', symptom_constipation: 'Stitichezza', symptom_nausea: 'Nausea',
    paywall_headline_default: 'Sblocca il percorso completo di GutBloom',
    paywall_sub_default: 'Premium ti dà tutto ciò di cui hai bisogno per il percorso completo dall\'eliminazione alla reintroduzione.',
    paywall_headline_reintro: 'Sblocca la tua reintroduzione completa',
    paywall_sub_reintro: 'Hai completato la prima sfida alimentare. Premium sblocca i restanti cinque gruppi FODMAP — la parte che ti dà la tua lista personale di alimenti sicuri.',
    paywall_headline_recipes: 'Sblocca oltre 50 ricette',
    paywall_sub_recipes: 'Hai esplorato le ricette gratuite. Premium apre la libreria completa di pasti sicuri per l\'eliminazione di tutte le cucine.',
    paywall_headline_history: 'Vedi la tua cronologia completa dei pattern',
    paywall_sub_history: 'La versione gratuita mostra questa settimana. Premium conserva la tua cronologia completa per osservare i pattern nel corso dei mesi.',
    paywall_headline_export: 'Esporta i tuoi dati per il medico',
    paywall_sub_export: 'Genera un PDF chiaro dei tuoi sintomi, fattori scatenanti e progressi da condividere con il tuo medico o dietista.',
    paywall_headline_scan: 'La scansione IA dei pasti è una funzione Premium',
    paywall_sub_scan: 'Fotografa un pasto per una stima FODMAP rapida. Premium include 30 scansioni al mese. La ricerca di alimenti e la scansione del codice a barre restano gratuite.',
    paywall_feat_reintro: 'Reintroduzione completa', paywall_feat_reintro_sub: 'Testa tutti e 6 i gruppi FODMAP, non solo il primo',
    paywall_feat_recipes: 'Oltre 50 ricette', paywall_feat_recipes_sub: 'Ogni pasto sicuro, tutte le cucine',
    paywall_feat_scan: 'La tua mappa FODMAP personale', paywall_feat_scan_sub: 'Scopri esattamente quali alimenti e porzioni fanno per te',
    paywall_feat_history: 'Cronologia completa dei pattern', paywall_feat_history_sub: 'Osserva le tendenze nel corso dei mesi, non solo questa settimana',
    paywall_feat_export: 'Esportazione per il medico', paywall_feat_export_sub: 'Un PDF chiaro dei tuoi dati per gli appuntamenti',
    paywall_free_note: 'La ricerca di alimenti, la scansione del codice a barre, il registro, GutGuide e la fase di eliminazione completa restano gratuiti — per sempre. Premium sblocca la reintroduzione e tutto ciò che segue.',
    paywall_best_badge: 'IDEALE PER IL PERCORSO',
    paywall_trial_note: '{price}. Disdici quando vuoi. Nessuna pubblicità, mai.',
    paywall_trial_btn: 'Ottieni Premium',
    paywall_annual_price: '69 €/anno · circa 5,75 €/mese',
    paywall_monthly_price: '8,99 €/mese',
    annual: 'Annuale', monthly: 'Mensile',
    settings_title: 'Impostazioni',
    settings_premium_active_sub: 'Il tuo percorso completo è sbloccato. Grazie per il tuo supporto.',
    settings_mid_journey: 'Già a metà percorso? Aggiorna la tua fase manualmente.',
    settings_current_phase: 'Fase attuale',
    settings_phase_not_started: 'Non ancora iniziato',
    settings_phase_elimination: 'Eliminazione',
    settings_phase_reintroduction: 'Reintroduzione',
    settings_week_label: 'Sono già alla settimana n.',
    settings_week_sub: 'Adatteremo la tua data di inizio di conseguenza.',
    settings_menstruate_q: 'Hai le mestruazioni?',
    settings_menstruate_sub: 'Se sì, mostriamo un tracker del ciclo nella schermata principale per individuare i pattern ormonali.',
    settings_other_intolerances: 'Altre intolleranze', settings_none: 'Nessuna',
    settings_other_intolerances_sub: 'Segnaleremo gli alimenti che sono low-FODMAP ma problematici per queste intolleranze.',
    settings_doctor_summary: 'Riepilogo per il medico', settings_doctor_export_btn: 'Esporta riepilogo per il medico',
    settings_doctor_sub: 'Esporta i tuoi dati come riepilogo da condividere con il tuo medico o dietista.',
    settings_save_phase: 'Salva modifiche alla fase',
    settings_custom_foods: 'I tuoi alimenti personalizzati', settings_custom_foods_sub: 'Alimenti che hai aggiunto. Tocca un punto per cambiare il livello FODMAP, o ✕ per rimuovere.',
    settings_start_over: 'Ricominciare da capo',
    settings_start_over_sub: 'Cancella tutti i tuoi dati — profilo, registri e progressi — e ripropone l\'onboarding. Non è reversibile.',
    settings_reset_confirm: 'Sì, cancella tutto',
    settings_reset_btn: 'Reimposta app',
    settings_disclaimer_title: 'Avviso sulla salute',
    settings_disclaimer_body: 'GutBloom è uno strumento di benessere e monitoraggio — non un dispositivo medico, e non un sostituto della consulenza, diagnosi o trattamento medico professionale. Non diagnostica condizioni né sostituisce il tuo medico. Per qualsiasi dubbio medico, rivolgiti sempre a un professionista sanitario. Il percorso low-FODMAP funziona meglio con una diagnosi di IBS e il supporto di un dietista formato sul FODMAP. Se hai sintomi gravi o allarmanti, contatta un medico.',
    settings_terms: 'Termini di servizio', settings_privacy: 'Informativa sulla privacy',
    plan_sub: 'Il tuo percorso FODMAP in due fasi',
    plan_period_pause: 'Considera una pausa',
    plan_period_pause_sub: 'Il ciclo può amplificare i sintomi del 30–40 %.',
    plan_phase1_eyebrow: 'FASE 1', plan_phase1_title: 'Eliminazione',
    plan_phase1_body: 'Ci prendiamo una pausa temporanea dagli alimenti scatenanti più comuni per calmare l\'intestino e creare una base di riferimento chiara — così le reazioni saranno più facili da individuare in seguito.',
    plan_elim_in_progress: 'In corso — vedi gli alimenti in pausa nella schermata principale',
    plan_elim_done: 'Completato — il tuo intestino ha avuto il tempo di calmarsi',
    plan_phase2_eyebrow: 'FASE 2', plan_phase2_title: 'Reintroduzione',
    plan_phase2_body: 'Un alimento alla volta, li reintroduciamo e osserviamo come risponde il tuo corpo — scoprendo i tuoi veri fattori scatenanti mentre ampliamo in modo sicuro la tua dieta.',
    plan_reintro_locked: 'Si sblocca dopo l\'eliminazione',
    plan_start_reintro: 'Inizia la fase di reintroduzione',
    plan_status_current: 'ATTUALE', plan_status_completed: 'COMPLETATO', plan_status_upcoming: 'PROSSIMO',
    plan_what_now: 'COSA FARE ORA',
    plan_categories: 'Categorie ({n}/6 completate)',
    plan_tolerated: 'Tollerato', plan_trigger: 'Fattore scatenante identificato',
    plan_in_progress: 'In corso', plan_premium_tap: 'Premium — tocca per sbloccare',
    plan_tap_start: 'Tocca per iniziare', plan_locked_until: 'Bloccato finché non sei pronto/a',
    plan_continue_reintro_title: '🌱 Continua la tua reintroduzione',
    plan_continue_reintro_body: 'Hai completato la prima sfida alimentare. Premium sblocca le cinque rimanenti — la parte che costruisce la tua lista personale di alimenti sicuri.',
    plan_disclaimer: 'Questo piano è una guida generale, non un consiglio medico. La dieta low-FODMAP funziona meglio con una diagnosi di IBS e un dietista formato sul FODMAP. Fermati e cerca assistenza se i sintomi sono gravi.',
    test_active_badge: 'TEST ATTIVO - GIORNO {day} DI 3',
    test_portion: 'Porzione di oggi: {portion}',
    test_no_reaction: 'Nessuna reazione', test_reacted: 'Reazione',
    test_day_logged_next: 'Giorno {day} registrato. Torna domani per la porzione {portion}.',
    test_day_logged_done: 'Giorno {day} registrato. Test completato!',
    test_cancel: 'Annulla test',
    test_modal_title: 'Testa {name}',
    test_protocol_badge: 'Protocollo Monash 3 giorni',
    test_protocol_body: 'Giorno 1: porzione piccola — Giorno 2: media — Giorno 3: grande\nSe hai una reazione, il test si interrompe prima. Dopo 3 giorni, riposa {rest} giorni prima della categoria successiva.',
    test_pick_food: 'Scegli un alimento da testare',
    test_day_portions: 'Giorno 1: {s} — Giorno 2: {m} — Giorno 3: {l}',
    test_start_btn: 'Inizia il test di 3 giorni',
    test_badge: 'TEST REINTRO',
    test_count_q: 'Contare questo come il test di oggi?',
    test_logged_q: 'Hai registrato {food}, che fa parte della tua reintroduzione di {cat}. Hai avuto una reazione?',
    test_how_bad: 'Quanto è intenso? ({n}/5)',
    test_save_btn: 'Salva il risultato del test',
    test_skip_link: 'Salta — non fa parte del test',
    toast_elim_started: 'Fase di eliminazione avviata',
    toast_reintro_started: 'Fase di reintroduzione avviata',
    toast_updated: 'Voce aggiornata',
    toast_deleted: 'Voce eliminata',
    toast_test_cancelled: 'Test annullato',
    toast_test_started: 'Test avviato',
    toast_test_tolerated: 'Test completato — tollerato!',
    toast_test_complete: 'Test completato',
    toast_day_logged: 'Giorno {n} registrato',
    toast_product_logged: '{name} registrato',
    toast_ai_logged: 'Scansione IA registrata',
    toast_welcome_premium: 'Benvenuto/a in Premium — il tuo percorso completo è sbloccato',
    toast_diagnosed: 'Grazie — questo ci aiuta a personalizzare il tuo piano',
    toast_period_started: 'Ciclo iniziato',
    toast_period_ended: 'Ciclo terminato',
    edit_title: 'Modifica voce',
    edit_foods_label: 'Alimenti (sola lettura)',
    edit_portion: 'Porzione',
    edit_portion_s: 'Piccola', edit_portion_m: 'Media', edit_portion_l: 'Grande',
    portion_or_less: 'o meno', portion_or_more: 'o più',
    unit_piece_one: 'pezzo', unit_piece_other: 'pezzi', unit_slice_one: 'fetta', unit_slice_other: 'fette',
    meal_portion_hint: 'Imposta la porzione per ogni ingrediente. Le taglie sono adattate a ogni alimento, con M come porzione tipica.',
    meal_dish_contains: 'Contiene',
    edit_hours_label: 'Ore: {n}h',
    edit_intensity_label: 'Intensità ({n}/5)',
    edit_stress_label: 'Livello di stress: {n}/5',
    edit_save_btn: 'Salva modifiche',
    edit_log_again: 'Registra di nuovo ora',
    edit_log_again_hint: 'Aggiunge questi alimenti come nuova voce, all\'ora attuale — questa resta invariata',
    edit_delete_btn: 'Elimina voce',
    barcode_title: 'Scansiona codice a barre',
    barcode_point: 'Punta verso un codice a barre',
    barcode_cam_needed: 'Autorizzazione fotocamera necessaria',
    barcode_allow: 'Consenti',
    barcode_looking: 'Ricerca in corso',
    barcode_found: 'TROVATO',
    barcode_risk: 'RISCHIO FODMAP',
    barcode_high: 'Alto rischio', barcode_low: 'Probabilmente sicuro',
    barcode_ingredients: 'INGREDIENTI',
    barcode_scan_another: 'Scansiona un altro',
    barcode_add: 'Aggiungi al diario',
    risk_low: 'Basso', risk_moderate: 'Moderato', risk_high: 'Alto',
    list_fermented: 'FERMENTATO', list_tolerated: 'tollerato', list_trigger: 'scatenante',
    hist_high: 'ALTO', hist_mod: 'MOD', hist_liberator: 'LIBERATORE',
    pill_day: 'Giorno {n}', detail_ferm_tag: 'FERMENTAZIONE', app_tagline: 'Il tuo intestino, in buone mani',
    form_seedling: 'Seme', form_sprout: 'Germoglio', form_growing: 'In crescita',
    form_blooming: 'In fioritura', form_thriving: 'Prospera',

    // Meal modal
    meal_modal_title: 'Registra un pasto',
    meal_discard_title: 'Eliminare questo pasto?',
    meal_discard_body: 'Non è ancora stato salvato: gli alimenti selezionati andranno persi.',
    meal_discard_keep: 'Continua a modificare',
    meal_discard_confirm: 'Elimina',
    meal_modal_search_ph: 'Cerca qualsiasi alimento',
    meal_modal_scan_btn: 'Scansiona codice a barre',
    barcode_intro_title: 'Scansiona un codice a barre',
    barcode_intro_body: 'Inquadra con la fotocamera il codice a barre di un prodotto confezionato: GutBloom lo cerca e mostra il probabile rischio FODMAP e gli ingredienti scatenanti, così decidi prima di mangiare.',
    barcode_intro_cta: 'Scansiona ora',
    barcode_intro_later: 'Forse più tardi',
    meal_modal_your_meal: 'Il tuo pasto',
    meal_edit_portion_of: 'Modifica porzione: {food}', meal_remove_item: 'Rimuovi dal pasto', meal_dish_remove_hint: 'Tocca un ingrediente per toglierlo', meal_dish_add_hint: 'Mangiato con extra (salsa, dip o contorno)? Aggiungili dalla ricerca nella schermata del pasto.', meal_ingredient_removed: 'tolto',
    meal_base_hint: 'Questa è una base — aggiungi gli altri ingredienti che hai usato (formaggio, verdure, condimenti…) così il punteggio corrisponde al tuo piatto.',
    meal_modal_hist_alert: 'Avviso istamina',
    meal_modal_high_hist: 'Alta istamina: {foods}.',
    meal_modal_hist_lib: 'Liberatori di istamina: {foods}.',
    meal_modal_hist_note: 'Questo pasto può essere povero di FODMAP ma comunque problematico per te.',
    meal_modal_results: 'Risultati',
    meal_modal_recent: 'Alimenti recenti',
    meal_modal_recent_meals: 'Pasti recenti',
    meal_type_label: 'Tipo', meal_type_breakfast: 'Colazione', meal_type_lunch: 'Pranzo', meal_type_dinner: 'Cena', meal_type_snack: 'Spuntino',
    meal_my_breakfast: 'La mia colazione', meal_my_lunch: 'Il mio pranzo', meal_my_dinner: 'La mia cena', meal_my_snack: 'Il mio spuntino',
    edit_dish: 'Piatto', meal_edit_extras: 'Ingredienti aggiunti', meal_edit_foods: 'Alimenti', meal_edit_add: 'Aggiungi alimento', meal_edit_none: 'Nessun alimento — aggiungine almeno uno.', edit_now_custom: 'Hai modificato gli ingredienti: ora è un pasto personalizzato.',
    meal_custom_q: 'Non trovi "{name}"?',
    meal_custom_tip: 'Suggerimento: se è un mix (come la pasta all\'amatriciana), aggiungi invece i singoli ingredienti — otterrai verdetti più precisi.',
    meal_custom_add: 'Scegli il suo livello FODMAP:',
    meal_custom_low_desc: 'riso, carne, uova, carote, patate, cheddar, fragole',
    meal_custom_mod_desc: 'avena, pasta, latte di mucca, funghi, ceci',
    meal_custom_high_desc: 'aglio, cipolla, grano, legumi, miele, frutti con nocciolo',
    meal_modal_pick: 'Scegli gli alimenti per registrare il tuo pasto',
    meal_modal_items_one: '{n} alimento', meal_modal_items: '{n} alimenti',
    meal_low: 'Basso in FODMAP', meal_moderate: 'Moderato', meal_high: 'Alto in FODMAP',
    meal_reason_from: 'per {food}', meal_reason_stack: 'FODMAP moderati che si sommano',
    meal_why_label: 'Perché',
    meal_swap_tip: 'Sostituisci {food} → {alt}',
  },
};

// Detect the phone's language; fall back to English if unsupported.
function detectLang() {
  try {
    const locales = Localization.getLocales();
    if (locales && locales.length > 0) {
      const code = (locales[0].languageCode || 'en').toLowerCase();
      if (SUPPORTED_LANGS.indexOf(code) >= 0) return code;
    }
  } catch (e) { /* fall through */ }
  return 'en';
}

// Translation lookup. Supports {n}-style interpolation. Falls back to English,
// then to the key itself, so a missing string is never a crash.
function makeT(lang) {
  const table = STRINGS[lang] || STRINGS.en;
  return function t(key, vars) {
    let str = table[key];
    if (str === undefined) str = STRINGS.en[key];
    if (str === undefined) return key;
    if (vars) {
      Object.keys(vars).forEach(k => { str = str.replace('{' + k + '}', vars[k]); });
    }
    return str;
  };
}

// Module-level UI language mirror, synced by the App on every render. Lets
// components that don't receive the `t` prop still localize via tG(...).
let _uiLang = 'en';
function tG(key, vars) {
  return makeT(_uiLang)(key, vars);
}

// Food name translations, keyed by food id. Order: de, es, fr, it.
// The English name lives on the food object itself and is the fallback.
const FOOD_NAMES = {
  carrot:        { de: 'Karotte', es: 'Zanahoria', fr: 'Carotte', it: 'Carota' },
  cucumber:      { de: 'Gurke', es: 'Pepino', fr: 'Concombre', it: 'Cetriolo' },
  potato:        { de: 'Kartoffel', es: 'Patata', fr: 'Pomme de terre', it: 'Patata' },
  lettuce:       { de: 'Kopfsalat', es: 'Lechuga', fr: 'Laitue', it: 'Lattuga' },
  kale:          { de: 'Grünkohl', es: 'Col rizada', fr: 'Chou frisé', it: 'Cavolo riccio' },
  pumpkin:       { de: 'Kürbis', es: 'Calabaza', fr: 'Potiron', it: 'Zucca' },
  olives:        { de: 'Oliven', es: 'Aceitunas', fr: 'Olives', it: 'Olive' },
  ginger:        { de: 'Ingwer', es: 'Jengibre', fr: 'Gingembre', it: 'Zenzero' },
  spinach:       { de: 'Babyspinat', es: 'Espinacas tiernas', fr: 'Jeunes épinards', it: 'Spinacino' },
  broccoli:      { de: 'Brokkoli', es: 'Brócoli', fr: 'Brocoli', it: 'Broccoli' },
  tomato:        { de: 'Tomate', es: 'Tomate', fr: 'Tomate', it: 'Pomodoro' },
  cherry_tomato: { de: 'Kirschtomate', es: 'Tomate cherry', fr: 'Tomate cerise', it: 'Pomodorino' },
  pepper_red:    { de: 'Paprika (rot)', es: 'Pimiento (rojo)', fr: 'Poivron (rouge)', it: 'Peperone (rosso)' },
  zucchini:      { de: 'Zucchini', es: 'Calabacín', fr: 'Courgette', it: 'Zucchina' },
  eggplant:      { de: 'Aubergine', es: 'Berenjena', fr: 'Aubergine', it: 'Melanzana' },
  green_beans:   { de: 'Grüne Bohnen', es: 'Judías verdes', fr: 'Haricots verts', it: 'Fagiolini' },
  sweet_corn:    { de: 'Zuckermais', es: 'Maíz dulce', fr: 'Maïs doux', it: 'Mais dolce' },
  cabbage_white: { de: 'Weißkohl', es: 'Col blanca', fr: 'Chou blanc', it: 'Cavolo cappuccio' },
  beetroot:      { de: 'Rote Bete', es: 'Remolacha', fr: 'Betterave', it: 'Barbabietola' },
  sweet_potato:  { de: 'Süßkartoffel', es: 'Boniato', fr: 'Patate douce', it: 'Patata dolce' },
  onion:         { de: 'Zwiebel', es: 'Cebolla', fr: 'Oignon', it: 'Cipolla' },
  shallot:       { de: 'Schalotte', es: 'Chalota', fr: 'Échalote', it: 'Scalogno' },
  garlic:        { de: 'Knoblauch', es: 'Ajo', fr: 'Ail', it: 'Aglio' },
  leek:          { de: 'Lauch', es: 'Puerro', fr: 'Poireau', it: 'Porro' },
  spring_onion:  { de: 'Frühlingszwiebel (grüner Teil)', es: 'Cebolleta (parte verde)', fr: 'Oignon nouveau (partie verte)', it: 'Cipollotto (parte verde)' },
  mushroom:      { de: 'Champignon', es: 'Champiñón', fr: 'Champignon', it: 'Fungo champignon' },
  oyster_mushroom:{ de: 'Austernpilz', es: 'Seta de ostra', fr: 'Pleurote', it: 'Fungo ostrica' },
  truffle:       { de: 'Trüffel', es: 'Trufa', fr: 'Truffe', it: 'Tartufo' },
  cauliflower:   { de: 'Blumenkohl', es: 'Coliflor', fr: 'Chou-fleur', it: 'Cavolfiore' },
  asparagus_green:{ de: 'Grüner Spargel', es: 'Espárrago verde', fr: 'Asperge verte', it: 'Asparago verde' },
  celery:        { de: 'Sellerie', es: 'Apio', fr: 'Céleri', it: 'Sedano' },
  sauerkraut:    { de: 'Sauerkraut', es: 'Chucrut', fr: 'Choucroute', it: 'Crauti' },
  kimchi:        { de: 'Kimchi', es: 'Kimchi', fr: 'Kimchi', it: 'Kimchi' },
  blueberry:     { de: 'Heidelbeere', es: 'Arándano', fr: 'Myrtille', it: 'Mirtillo' },
  kiwi:          { de: 'Kiwi', es: 'Kiwi', fr: 'Kiwi', it: 'Kiwi' },
  orange:        { de: 'Orange', es: 'Naranja', fr: 'Orange', it: 'Arancia' },
  mandarin:      { de: 'Mandarine', es: 'Mandarina', fr: 'Mandarine', it: 'Mandarino' },
  lemon:         { de: 'Zitrone', es: 'Limón', fr: 'Citron', it: 'Limone' },
  pineapple:     { de: 'Ananas', es: 'Piña', fr: 'Ananas', it: 'Ananas' },
  raspberry:     { de: 'Himbeere', es: 'Frambuesa', fr: 'Framboise', it: 'Lampone' },
  strawberry:    { de: 'Erdbeere', es: 'Fresa', fr: 'Fraise', it: 'Fragola' },
  banana_green:  { de: 'Grüne Banane', es: 'Plátano verde', fr: 'Banane verte', it: 'Banana verde' },
  banana:        { de: 'Reife Banane', es: 'Plátano maduro', fr: 'Banane mûre', it: 'Banana matura' },
  cherries:      { de: 'Kirschen', es: 'Cerezas', fr: 'Cerises', it: 'Ciliegie' },
  blackberries:  { de: 'Brombeeren', es: 'Moras', fr: 'Mûres', it: 'More' },
  plum:          { de: 'Pflaume', es: 'Ciruela', fr: 'Prune', it: 'Prugna' },
  nectarine:     { de: 'Nektarine', es: 'Nectarina', fr: 'Nectarine', it: 'Pesca noce' },
  pomegranate:   { de: 'Granatapfel', es: 'Granada', fr: 'Grenade', it: 'Melograno' },
  honeydew:      { de: 'Honigmelone', es: 'Melón', fr: 'Melon miel', it: 'Melone bianco' },
  cantaloupe:    { de: 'Cantaloupe-Melone', es: 'Melón cantalupo', fr: 'Cantaloup', it: 'Melone' },
  grapefruit:    { de: 'Grapefruit', es: 'Pomelo', fr: 'Pamplemousse', it: 'Pompelmo' },
  papaya:        { de: 'Papaya', es: 'Papaya', fr: 'Papaye', it: 'Papaya' },
  passionfruit:  { de: 'Passionsfrucht', es: 'Maracuyá', fr: 'Fruit de la passion', it: 'Frutto della passione' },
  raisins:       { de: 'Rosinen', es: 'Pasas', fr: 'Raisins secs', it: 'Uvetta' },
  dates:         { de: 'Datteln', es: 'Dátiles', fr: 'Dattes', it: 'Datteri' },
  dried_apricot: { de: 'Getrocknete Aprikosen', es: 'Orejones', fr: 'Abricots secs', it: 'Albicocche secche' },
  prunes:        { de: 'Backpflaumen', es: 'Ciruelas pasas', fr: 'Pruneaux', it: 'Prugne secche' },
  dried_fig:     { de: 'Getrocknete Feigen', es: 'Higos secos', fr: 'Figues sèches', it: 'Fichi secchi' },
  dried_mango:   { de: 'Getrocknete Mango', es: 'Mango deshidratado', fr: 'Mangue séchée', it: 'Mango essiccato' },
  dried_cranberry:{ de: 'Getrocknete Cranberrys', es: 'Arándanos secos', fr: 'Canneberges séchées', it: 'Mirtilli rossi secchi' },
  mango:         { de: 'Mango', es: 'Mango', fr: 'Mangue', it: 'Mango' },
  grapes:        { de: 'Weintrauben', es: 'Uvas', fr: 'Raisin', it: 'Uva' },
  avocado:       { de: 'Avocado', es: 'Aguacate', fr: 'Avocat', it: 'Avocado' },
  apple:         { de: 'Apfel', es: 'Manzana', fr: 'Pomme', it: 'Mela' },
  pear:          { de: 'Birne', es: 'Pera', fr: 'Poire', it: 'Pera' },
  watermelon:    { de: 'Wassermelone', es: 'Sandía', fr: 'Pastèque', it: 'Anguria' },
  peach:         { de: 'Pfirsich', es: 'Melocotón', fr: 'Pêche', it: 'Pesca' },
  apricot:       { de: 'Aprikose', es: 'Albaricoque', fr: 'Abricot', it: 'Albicocca' },
  apple_juice:   { de: 'Apfelsaft', es: 'Zumo de manzana', fr: 'Jus de pomme', it: 'Succo di mela' },
  rice:          { de: 'Weißer Reis', es: 'Arroz blanco', fr: 'Riz blanc', it: 'Riso bianco' },
  rice_brown:    { de: 'Vollkornreis', es: 'Arroz integral', fr: 'Riz complet', it: 'Riso integrale' },
  quinoa:        { de: 'Quinoa', es: 'Quinoa', fr: 'Quinoa', it: 'Quinoa' },
  buckwheat:     { de: 'Buchweizen', es: 'Trigo sarraceno', fr: 'Sarrasin', it: 'Grano saraceno' },
  rice_noodle:   { de: 'Reisnudeln', es: 'Fideos de arroz', fr: 'Nouilles de riz', it: 'Noodles di riso' },
  gluten_free_bread:{ de: 'Glutenfreies Brot', es: 'Pan sin gluten', fr: 'Pain sans gluten', it: 'Pane senza glutine' },
  gluten_free_pasta:{ de: 'Glutenfreie Pasta', es: 'Pasta sin gluten', fr: 'Pâtes sans gluten', it: 'Pasta senza glutine' },
  oats:          { de: 'Haferflocken', es: 'Copos de avena', fr: "Flocons d'avoine", it: "Fiocchi d'avena" },
  pasta:         { de: 'Weizenpasta', es: 'Pasta de trigo', fr: 'Pâtes de blé', it: 'Pasta di grano' },
  sourdough_spelt:{ de: 'Dinkel-Sauerteigbrot', es: 'Masa madre de espelta', fr: 'Levain d\'épeautre', it: 'Pasta madre di farro' },
  bread:         { de: 'Weizenbrot', es: 'Pan de trigo', fr: 'Pain de blé', it: 'Pane di grano' },
  pizza_dough:   { de: 'Pizzateig', es: 'Masa de pizza', fr: 'Pâte à pizza', it: 'Impasto per pizza' },
  pinsa_dough:   { de: 'Pinsa-Teig', es: 'Masa de pinsa', fr: 'Pâte à pinsa', it: 'Impasto per pinsa' },
  flatbread:     { de: 'Fladenbrot', es: 'Pan plano', fr: 'Pain plat', it: 'Pane piatto' },
  corn_tortilla: { de: 'Maistortilla', es: 'Tortilla de maíz', fr: 'Tortilla de maïs', it: 'Tortilla di mais' },
  rye_bread:     { de: 'Roggenbrot', es: 'Pan de centeno', fr: 'Pain de seigle', it: 'Pane di segale' },
  brotchen:      { de: 'Brötchen', es: 'Panecillo', fr: 'Petit pain', it: 'Panino' },
  whole_wheat_bread:{ de: 'Vollkornbrot', es: 'Pan integral', fr: 'Pain complet', it: 'Pane integrale' },
  spatzle:       { de: 'Spätzle', es: 'Spätzle', fr: 'Spätzle', it: 'Spätzle' },
  milk_lf:       { de: 'Laktosefreie Milch', es: 'Leche sin lactosa', fr: 'Lait sans lactose', it: 'Latte senza lattosio' },
  almond_milk:   { de: 'Mandelmilch', es: 'Leche de almendras', fr: "Lait d'amande", it: 'Latte di mandorla' },
  cheddar:       { de: 'Cheddar', es: 'Cheddar', fr: 'Cheddar', it: 'Cheddar' },
  parmesan:      { de: 'Parmesan', es: 'Parmesano', fr: 'Parmesan', it: 'Parmigiano' },
  mozzarella:    { de: 'Mozzarella', es: 'Mozzarella', fr: 'Mozzarella', it: 'Mozzarella' },
  feta:          { de: 'Feta', es: 'Feta', fr: 'Feta', it: 'Feta' },
  brie:          { de: 'Brie', es: 'Brie', fr: 'Brie', it: 'Brie' },
  camembert:     { de: 'Camembert', es: 'Camembert', fr: 'Camembert', it: 'Camembert' },
  swiss_cheese:  { de: 'Emmentaler', es: 'Queso suizo', fr: 'Emmental', it: 'Emmental' },
  gouda:         { de: 'Gouda', es: 'Gouda', fr: 'Gouda', it: 'Gouda' },
  gruyere:       { de: 'Gruyère', es: 'Gruyer', fr: 'Gruyère', it: 'Groviera' },
  provolone:     { de: 'Provolone', es: 'Provolone', fr: 'Provolone', it: 'Provolone' },
  pecorino:      { de: 'Pecorino', es: 'Pecorino', fr: 'Pecorino', it: 'Pecorino' },
  goat_cheese:   { de: 'Ziegenkäse', es: 'Queso de cabra', fr: 'Fromage de chèvre', it: 'Formaggio di capra' },
  blue_cheese:   { de: 'Blauschimmelkäse', es: 'Queso azul', fr: 'Fromage bleu', it: 'Formaggio blu' },
  halloumi:      { de: 'Halloumi', es: 'Halloumi', fr: 'Halloumi', it: 'Halloumi' },
  ricotta:       { de: 'Ricotta', es: 'Ricotta', fr: 'Ricotta', it: 'Ricotta' },
  burrata:       { de: 'Burrata', es: 'Burrata', fr: 'Burrata', it: 'Burrata' },
  cottage_cheese:{ de: 'Hüttenkäse', es: 'Requesón', fr: 'Cottage', it: 'Fiocchi di latte' },
  butter:        { de: 'Butter', es: 'Mantequilla', fr: 'Beurre', it: 'Burro' },
  lactose_free_yogurt:{ de: 'Laktosefreier Joghurt', es: 'Yogur sin lactosa', fr: 'Yaourt sans lactose', it: 'Yogurt senza lattosio' },
  cream_cheese:  { de: 'Frischkäse', es: 'Queso crema', fr: 'Fromage frais', it: 'Formaggio spalmabile' },
  quark:         { de: 'Quark', es: 'Quark', fr: 'Fromage blanc', it: 'Quark' },
  cream:         { de: 'Sahne', es: 'Nata', fr: 'Crème', it: 'Panna' },
  creme_fraiche: { de: 'Crème fraîche', es: 'Crème fraîche', fr: 'Crème fraîche', it: 'Crème fraîche' },
  sour_cream:    { de: 'Schmand', es: 'Crema agria', fr: 'Crème aigre', it: 'Panna acida' },
  mascarpone:    { de: 'Mascarpone', es: 'Mascarpone', fr: 'Mascarpone', it: 'Mascarpone' },
  oat_milk:      { de: 'Hafermilch', es: 'Leche de avena', fr: "Lait d'avoine", it: "Latte d'avena" },
  yogurt:        { de: 'Joghurt', es: 'Yogur', fr: 'Yaourt', it: 'Yogurt' },
  greek_yogurt:  { de: 'Griechischer Joghurt', es: 'Yogur griego', fr: 'Yaourt grec', it: 'Yogurt greco' },
  skyr:          { de: 'Skyr', es: 'Skyr', fr: 'Skyr', it: 'Skyr' },
  kefir:         { de: 'Kefir', es: 'Kéfir', fr: 'Kéfir', it: 'Kefir' },
  milk:          { de: 'Kuhmilch', es: 'Leche de vaca', fr: 'Lait de vache', it: 'Latte vaccino' },
  chicken:       { de: 'Hähnchen', es: 'Pollo', fr: 'Poulet', it: 'Pollo' },
  turkey:        { de: 'Pute', es: 'Pavo', fr: 'Dinde', it: 'Tacchino' },
  beef:          { de: 'Rindfleisch', es: 'Carne de res', fr: 'Bœuf', it: 'Manzo' },
  pork:          { de: 'Schweinefleisch', es: 'Cerdo', fr: 'Porc', it: 'Maiale' },
  salmon:        { de: 'Lachs', es: 'Salmón', fr: 'Saumon', it: 'Salmone' },
  lamb:          { de: 'Lamm', es: 'Cordero', fr: 'Agneau', it: 'Agnello' },
  veal:          { de: 'Kalb', es: 'Ternera', fr: 'Veau', it: 'Vitello' },
  meat_lamb_chicken: { de: 'Lamm oder Hähnchen', es: 'Cordero o pollo', fr: 'Agneau ou poulet', it: 'Agnello o pollo' },
  meat_beef_pork:    { de: 'Rind oder Schwein', es: 'Res o cerdo', fr: 'Bœuf ou porc', it: 'Manzo o maiale' },
  meat_veal_pork:    { de: 'Kalb oder Schwein', es: 'Ternera o cerdo', fr: 'Veau ou porc', it: 'Vitello o maiale' },
  meat_beef_chicken: { de: 'Rind oder Hähnchen', es: 'Res o pollo', fr: 'Bœuf ou poulet', it: 'Manzo o pollo' },
  meat_pork_chicken: { de: 'Schwein oder Hähnchen', es: 'Cerdo o pollo', fr: 'Porc ou poulet', it: 'Maiale o pollo' },
  duck:          { de: 'Ente', es: 'Pato', fr: 'Canard', it: 'Anatra' },
  ground_beef:   { de: 'Hackfleisch', es: 'Carne picada', fr: 'Bœuf haché', it: 'Carne macinata' },
  bacon:         { de: 'Speck', es: 'Bacon', fr: 'Bacon', it: 'Pancetta' },
  ham:           { de: 'Schinken', es: 'Jamón', fr: 'Jambon', it: 'Prosciutto cotto' },
  prosciutto:    { de: 'Rohschinken', es: 'Jamón serrano', fr: 'Jambon cru', it: 'Prosciutto crudo' },
  salami:        { de: 'Salami', es: 'Salami', fr: 'Salami', it: 'Salame' },
  white_fish:    { de: 'Weißfisch', es: 'Pescado blanco', fr: 'Poisson blanc', it: 'Pesce bianco' },
  oily_fish:     { de: 'Fetter Fisch', es: 'Pescado azul', fr: 'Poisson gras', it: 'Pesce azzurro' },
  shellfish:     { de: 'Meeresfrüchte', es: 'Mariscos', fr: 'Fruits de mer', it: 'Frutti di mare' },
  sesame_seeds:  { de: 'Sesam', es: 'Sésamo', fr: 'Sésame', it: 'Sesamo' },
  flaxseed:      { de: 'Leinsamen', es: 'Semillas de lino', fr: 'Graines de lin', it: 'Semi di lino' },
  poppy_seeds:   { de: 'Mohn', es: 'Semillas de amapola', fr: 'Graines de pavot', it: 'Semi di papavero' },
  hemp_seeds:    { de: 'Hanfsamen', es: 'Semillas de cáñamo', fr: 'Graines de chanvre', it: 'Semi di canapa' },
  cornflakes:    { de: 'Cornflakes', es: 'Copos de maíz', fr: 'Corn flakes', it: 'Fiocchi di mais' },
  muesli:        { de: 'Müsli', es: 'Muesli', fr: 'Muesli', it: 'Muesli' },
  granola:       { de: 'Granola', es: 'Granola', fr: 'Granola', it: 'Granola' },
  bran_cereal:   { de: 'Kleieflocken', es: 'Cereal de salvado', fr: 'Céréales au son', it: 'Cereali di crusca' },
  black_tea:     { de: 'Schwarzer Tee', es: 'Té negro', fr: 'Thé noir', it: 'Tè nero' },
  orange_juice:  { de: 'Orangensaft', es: 'Zumo de naranja', fr: "Jus d'orange", it: "Succo d'arancia" },
  pear_juice:    { de: 'Birnensaft', es: 'Zumo de pera', fr: 'Jus de poire', it: 'Succo di pera' },
  soft_drink:    { de: 'Limonade', es: 'Refresco', fr: 'Soda', it: 'Bibita' },
  coconut_water: { de: 'Kokoswasser', es: 'Agua de coco', fr: 'Eau de coco', it: 'Acqua di cocco' },
  chamomile_tea: { de: 'Kamillentee', es: 'Té de manzanilla', fr: 'Camomille', it: 'Camomilla' },
  fennel_tea:    { de: 'Fencheltee', es: 'Té de hinojo', fr: 'Tisane de fenouil', it: 'Tè al finocchio' },
  soy_milk:      { de: 'Sojamilch', es: 'Leche de soja', fr: 'Lait de soja', it: 'Latte di soia' },
  tuna:          { de: 'Thunfisch', es: 'Atún', fr: 'Thon', it: 'Tonno' },
  shrimp:        { de: 'Garnelen', es: 'Gambas', fr: 'Crevettes', it: 'Gamberi' },
  egg:           { de: 'Ei', es: 'Huevo', fr: 'Œuf', it: 'Uovo' },
  tofu:          { de: 'Tofu (fest)', es: 'Tofu (firme)', fr: 'Tofu (ferme)', it: 'Tofu (compatto)' },
  tofu_silken:   { de: 'Tofu (seiden)', es: 'Tofu (sedoso)', fr: 'Tofu (soyeux)', it: 'Tofu (vellutato)' },
  tempeh:        { de: 'Tempeh', es: 'Tempeh', fr: 'Tempeh', it: 'Tempeh' },
  seitan:        { de: 'Seitan', es: 'Seitán', fr: 'Seitan', it: 'Seitan' },
  bratwurst:     { de: 'Bratwurst', es: 'Salchicha bratwurst', fr: 'Bratwurst', it: 'Bratwurst' },
  currywurst:    { de: 'Currywurst', es: 'Currywurst', fr: 'Currywurst', it: 'Currywurst' },
  lentils:       { de: 'Linsen', es: 'Lentejas', fr: 'Lentilles', it: 'Lenticchie' },
  chickpeas:     { de: 'Kichererbsen', es: 'Garbanzos', fr: 'Pois chiches', it: 'Ceci' },
  kidney_beans:  { de: 'Kidneybohnen', es: 'Alubias rojas', fr: 'Haricots rouges', it: 'Fagioli rossi' },
  peanuts:       { de: 'Erdnüsse', es: 'Cacahuetes', fr: 'Cacahuètes', it: 'Arachidi' },
  walnuts:       { de: 'Walnüsse', es: 'Nueces', fr: 'Noix', it: 'Noci' },
  pumpkin_seeds: { de: 'Kürbiskerne', es: 'Pipas de calabaza', fr: 'Graines de courge', it: 'Semi di zucca' },
  sunflower_seeds:{ de: 'Sonnenblumenkerne', es: 'Pipas de girasol', fr: 'Graines de tournesol', it: 'Semi di girasole' },
  chia_seeds:    { de: 'Chiasamen', es: 'Semillas de chía', fr: 'Graines de chia', it: 'Semi di chia' },
  almonds:       { de: 'Mandeln', es: 'Almendras', fr: 'Amandes', it: 'Mandorle' },
  hazelnuts:     { de: 'Haselnüsse', es: 'Avellanas', fr: 'Noisettes', it: 'Nocciole' },
  cashews:       { de: 'Cashewnüsse', es: 'Anacardos', fr: 'Noix de cajou', it: 'Anacardi' },
  maple:         { de: 'Ahornsirup', es: 'Sirope de arce', fr: "Sirop d'érable", it: "Sciroppo d'acero" },
  sugar:         { de: 'Weißer Zucker', es: 'Azúcar blanco', fr: 'Sucre blanc', it: 'Zucchero bianco' },
  dark_chocolate:{ de: 'Zartbitterschokolade (85%)', es: 'Chocolate negro (85%)', fr: 'Chocolat noir (85%)', it: 'Cioccolato fondente (85%)' },
  milk_chocolate:{ de: 'Milchschokolade', es: 'Chocolate con leche', fr: 'Chocolat au lait', it: 'Cioccolato al latte' },
  honey:         { de: 'Honig', es: 'Miel', fr: 'Miel', it: 'Miele' },
  agave:         { de: 'Agavensirup', es: 'Sirope de agave', fr: "Sirop d'agave", it: "Sciroppo d'agave" },
  olive_oil:     { de: 'Olivenöl', es: 'Aceite de oliva', fr: "Huile d'olive", it: "Olio d'oliva" },
  garlic_oil:    { de: 'Knoblauchöl', es: 'Aceite de ajo', fr: "Huile d'ail", it: "Olio all'aglio" },
  soy_sauce:     { de: 'Sojasoße', es: 'Salsa de soja', fr: 'Sauce soja', it: 'Salsa di soia' },
  mustard:       { de: 'Senf', es: 'Mostaza', fr: 'Moutarde', it: 'Senape' },
  mayo:          { de: 'Mayonnaise', es: 'Mayonesa', fr: 'Mayonnaise', it: 'Maionese' },
  pesto:         { de: 'Basilikum-Pesto (ohne Knoblauch)', es: 'Pesto de albahaca (sin ajo)', fr: 'Pesto au basilic (sans ail)', it: 'Pesto al basilico (senza aglio)' },
  pesto_garlic:  { de: 'Basilikum-Pesto (mit Knoblauch)', es: 'Pesto de albahaca (con ajo)', fr: 'Pesto au basilic (avec ail)', it: 'Pesto al basilico (con aglio)' },
  pasta_sauce:   { de: 'Tomaten-Pastasoße (mit Zwiebel/Knoblauch)', es: 'Salsa de tomate para pasta (con cebolla/ajo)', fr: 'Sauce tomate pour pâtes (oignon/ail)', it: 'Sugo di pomodoro (con cipolla/aglio)' },
  pasta_sauce_plain: { de: 'Tomaten-Pastasoße (ohne Zwiebel/Knoblauch)', es: 'Salsa de tomate para pasta (sin cebolla/ajo)', fr: 'Sauce tomate pour pâtes (sans oignon/ail)', it: 'Sugo di pomodoro (senza cipolla/aglio)' },
  hummus:        { de: 'Hummus', es: 'Hummus', fr: 'Houmous', it: 'Hummus' },
  ketchup:       { de: 'Ketchup', es: 'Kétchup', fr: 'Ketchup', it: 'Ketchup' },
  garlic_sauce:  { de: 'Knoblauchsoße', es: 'Salsa de ajo', fr: 'Sauce à l’ail', it: 'Salsa all’aglio' },
  yogurt_sauce:  { de: 'Joghurtsoße', es: 'Salsa de yogur', fr: 'Sauce au yaourt', it: 'Salsa allo yogurt' },
  tzatziki:      { de: 'Tzatziki', es: 'Tzatziki', fr: 'Tzatzíki', it: 'Tzatziki' },
  hot_sauce:     { de: 'Scharfe Soße (Chili)', es: 'Salsa picante (chile)', fr: 'Sauce piquante (piment)', it: 'Salsa piccante (peperoncino)' },
  sriracha:      { de: 'Sriracha', es: 'Sriracha', fr: 'Sriracha', it: 'Sriracha' },
  bbq_sauce:     { de: 'BBQ-Soße', es: 'Salsa barbacoa', fr: 'Sauce barbecue', it: 'Salsa barbecue' },
  sweet_chili:   { de: 'Süße Chilisoße', es: 'Salsa de chile dulce', fr: 'Sauce chili sucrée', it: 'Salsa chili dolce' },
  tahini:        { de: 'Tahini', es: 'Tahini', fr: 'Tahini', it: 'Tahina' },
  salsa:         { de: 'Salsa', es: 'Salsa', fr: 'Salsa', it: 'Salsa' },
  water:         { de: 'Wasser', es: 'Agua', fr: 'Eau', it: 'Acqua' },
  coffee:        { de: 'Kaffee', es: 'Café', fr: 'Café', it: 'Caffè' },
  tea_green:     { de: 'Grüner Tee', es: 'Té verde', fr: 'Thé vert', it: 'Tè verde' },
  tea_peppermint:{ de: 'Pfefferminztee', es: 'Té de menta', fr: 'Tisane de menthe', it: 'Tè alla menta' },
  beer:          { de: 'Bier', es: 'Cerveza', fr: 'Bière', it: 'Birra' },
  wine_white:    { de: 'Weißwein', es: 'Vino blanco', fr: 'Vin blanc', it: 'Vino bianco' },
  wine_red:      { de: 'Rotwein', es: 'Vino tinto', fr: 'Vin rouge', it: 'Vino rosso' },
  pizza:{ de: 'Pizza Margherita (einfach)', es: 'Pizza Margarita (simple)', fr: 'Pizza Margherita (simple)', it: 'Pizza Margherita (semplice)' },
  pinsa:         { de: 'Pinsa (einfach)', es: 'Pinsa (simple)', fr: 'Pinsa (simple)', it: 'Pinsa (semplice)' },
  lasagna:       { de: 'Lasagne', es: 'Lasaña', fr: 'Lasagnes', it: 'Lasagne' },
  spaghetti_bolognese:{ de: 'Spaghetti Bolognese', es: 'Espaguetis a la boloñesa', fr: 'Spaghettis bolognaise', it: 'Spaghetti alla bolognese' },
  spaghetti_carbonara:{ de: 'Spaghetti Carbonara', es: 'Espaguetis carbonara', fr: 'Spaghettis carbonara', it: 'Spaghetti alla carbonara' },
  risotto:       { de: 'Risotto (einfach)', es: 'Risotto (simple)', fr: 'Risotto (simple)', it: 'Risotto (semplice)' },
  caprese_salad: { de: 'Caprese-Salat', es: 'Ensalada caprese', fr: 'Salade caprese', it: 'Insalata caprese' },
  minestrone:    { de: 'Minestrone-Suppe', es: 'Sopa minestrone', fr: 'Soupe minestrone', it: 'Minestrone' },
  tiramisu:      { de: 'Tiramisu', es: 'Tiramisú', fr: 'Tiramisu', it: 'Tiramisù' },
  cheeseburger:  { de: 'Cheeseburger', es: 'Hamburguesa con queso', fr: 'Cheeseburger', it: 'Cheeseburger' },
  french_fries:  { de: 'Pommes frites', es: 'Patatas fritas', fr: 'Frites', it: 'Patatine fritte' },
  hot_dog:       { de: 'Hot Dog', es: 'Perrito caliente', fr: 'Hot-dog', it: 'Hot dog' },
  mac_cheese:    { de: 'Mac and Cheese', es: 'Macarrones con queso', fr: 'Mac and cheese', it: 'Pasta al formaggio' },
  pancakes:      { de: 'Pfannkuchen', es: 'Tortitas', fr: 'Pancakes', it: 'Pancake' },
  club_sandwich: { de: 'Club-Sandwich', es: 'Sándwich club', fr: 'Club sandwich', it: 'Club sandwich' },
  caesar_salad:  { de: 'Caesar Salad', es: 'Ensalada César', fr: 'Salade César', it: 'Insalata Caesar' },
  bagel_cream_cheese:{ de: 'Bagel mit Frischkäse', es: 'Bagel con queso crema', fr: 'Bagel au fromage frais', it: 'Bagel con formaggio spalmabile' },
  bbq_ribs:      { de: 'BBQ-Rippchen', es: 'Costillas BBQ', fr: 'Travers de porc BBQ', it: 'Costine BBQ' },
  buffalo_wings: { de: 'Buffalo Wings', es: 'Alitas búfalo', fr: 'Ailes Buffalo', it: 'Alette di pollo Buffalo' },
  cobb_salad:    { de: 'Cobb-Salat', es: 'Ensalada Cobb', fr: 'Salade Cobb', it: 'Insalata Cobb' },
  fried_rice:    { de: 'Gebratener Reis', es: 'Arroz frito', fr: 'Riz frit', it: 'Riso saltato' },
  kung_pao_chicken:{ de: 'Kung-Pao-Hähnchen', es: 'Pollo kung pao', fr: 'Poulet kung pao', it: 'Pollo kung pao' },
  sweet_sour_pork:{ de: 'Süß-saures Schweinefleisch', es: 'Cerdo agridulce', fr: 'Porc aigre-doux', it: 'Maiale in agrodolce' },
  chow_mein:     { de: 'Chow Mein', es: 'Chow mein', fr: 'Chow mein', it: 'Chow mein' },
  spring_rolls:  { de: 'Frühlingsrollen', es: 'Rollitos de primavera', fr: 'Rouleaux de printemps', it: 'Involtini primavera' },
  dumplings:     { de: 'Teigtaschen (Schwein)', es: 'Empanadillas (cerdo)', fr: 'Raviolis (porc)', it: 'Ravioli cinesi (maiale)' },
  mapo_tofu:     { de: 'Mapo Tofu', es: 'Tofu mapo', fr: 'Mapo tofu', it: 'Mapo tofu' },
  wonton_soup:   { de: 'Wan-Tan-Suppe', es: 'Sopa wonton', fr: 'Soupe wonton', it: 'Zuppa di wonton' },
  beef_broccoli: { de: 'Rindfleisch mit Brokkoli', es: 'Ternera con brócoli', fr: 'Bœuf au brocoli', it: 'Manzo e broccoli' },
  steamed_dumplings_shrimp:{ de: 'Garnelen-Teigtaschen (Har Gow)', es: 'Empanadillas de gambas (har gow)', fr: 'Raviolis aux crevettes (har gow)', it: 'Ravioli di gamberi (har gow)' },
  butter_chicken:{ de: 'Butter Chicken', es: 'Pollo a la mantequilla', fr: 'Poulet au beurre', it: 'Pollo al burro' },
  chicken_tikka_masala:{ de: 'Chicken Tikka Masala', es: 'Pollo tikka masala', fr: 'Poulet tikka masala', it: 'Pollo tikka masala' },
  palak_paneer:  { de: 'Palak Paneer', es: 'Palak paneer', fr: 'Palak paneer', it: 'Palak paneer' },
  dal_lentil:    { de: 'Dal (Linsencurry)', es: 'Dal (curry de lentejas)', fr: 'Dal (curry de lentilles)', it: 'Dal (curry di lenticchie)' },
  chana_masala:  { de: 'Chana Masala', es: 'Chana masala', fr: 'Chana masala', it: 'Chana masala' },
  naan:          { de: 'Naan-Brot', es: 'Pan naan', fr: 'Pain naan', it: 'Pane naan' },
  samosa:        { de: 'Samosa', es: 'Samosa', fr: 'Samoussa', it: 'Samosa' },
  biryani:       { de: 'Hähnchen-Biryani', es: 'Biryani de pollo', fr: 'Biryani de poulet', it: 'Biryani di pollo' },
  tandoori_chicken:{ de: 'Tandoori-Hähnchen', es: 'Pollo tandoori', fr: 'Poulet tandoori', it: 'Pollo tandoori' },
  aloo_gobi:     { de: 'Aloo Gobi', es: 'Aloo gobi', fr: 'Aloo gobi', it: 'Aloo gobi' },
  raita:         { de: 'Raita (Joghurtsoße)', es: 'Raita (salsa de yogur)', fr: 'Raïta (sauce au yaourt)', it: 'Raita (salsa allo yogurt)' },
  plain_dosa:    { de: 'Einfacher Dosa', es: 'Dosa simple', fr: 'Dosa nature', it: 'Dosa semplice' },
  kebab:         { de: 'Döner Kebab', es: 'Kebab (döner)', fr: 'Kebab (döner)', it: 'Kebab (döner)' },
  schnitzel:     { de: 'Schnitzel', es: 'Escalope empanado', fr: 'Escalope panée', it: 'Cotoletta' },
  croissant:     { de: 'Croissant', es: 'Cruasán', fr: 'Croissant', it: 'Cornetto' },
  baguette:      { de: 'Baguette', es: 'Baguete', fr: 'Baguette', it: 'Baguette' },
  quiche:        { de: 'Quiche Lorraine', es: 'Quiche Lorraine', fr: 'Quiche lorraine', it: 'Quiche Lorraine' },
  paella:        { de: 'Paella', es: 'Paella', fr: 'Paella', it: 'Paella' },
  tortilla_espanola:{ de: 'Spanische Tortilla', es: 'Tortilla española', fr: 'Tortilla espagnole', it: 'Tortilla spagnola' },
  fish_and_chips:{ de: 'Fish and Chips', es: 'Pescado con patatas', fr: 'Fish and chips', it: 'Fish and chips' },
  goulash:       { de: 'Gulasch', es: 'Gulash', fr: 'Goulache', it: 'Gulasch' },
  moussaka:      { de: 'Moussaka', es: 'Musaka', fr: 'Moussaka', it: 'Moussaka' },
  pretzel:       { de: 'Brezel', es: 'Pretzel', fr: 'Bretzel', it: 'Pretzel' },
  greek_salad:   { de: 'Griechischer Salat', es: 'Ensalada griega', fr: 'Salade grecque', it: 'Insalata greca' },
  crepe:         { de: 'Crêpe', es: 'Crep', fr: 'Crêpe', it: 'Crêpe' },
  fried_chicken: { de: 'Frittiertes Hähnchen', es: 'Pollo frito', fr: 'Poulet frit', it: 'Pollo fritto' },
  burrito:       { de: 'Burrito', es: 'Burrito', fr: 'Burrito', it: 'Burrito' },
  taco:          { de: 'Rindfleisch-Taco', es: 'Taco de ternera', fr: 'Taco au bœuf', it: 'Taco di manzo' },
  taco_chicken:  { de: 'Hähnchen-Taco', es: 'Taco de pollo', fr: 'Taco au poulet', it: 'Taco di pollo' },
  taco_fish:     { de: 'Fisch-Taco', es: 'Taco de pescado', fr: 'Taco au poisson', it: 'Taco di pesce' },
  taco_pork:     { de: 'Schweine-Taco (al pastor)', es: 'Taco al pastor', fr: 'Taco al pastor', it: 'Taco al pastor' },
  burger:        { de: 'Burger (einfach)', es: 'Hamburguesa (simple)', fr: 'Burger (simple)', it: 'Hamburger (semplice)' },
  burger_vegan:  { de: 'Veganer Burger (einfach)', es: 'Hamburguesa vegana (simple)', fr: 'Burger vegan (simple)', it: 'Hamburger vegano (semplice)' },
  plant_patty:   { de: 'Pflanzliches Patty', es: 'Hamburguesa vegetal (solo medallón)', fr: 'Steak végétal', it: 'Burger vegetale (solo polpetta)' },
  gyros:         { de: 'Gyros', es: 'Gyros', fr: 'Gyros', it: 'Gyros' },
  souvlaki:      { de: 'Souvlaki', es: 'Souvlaki', fr: 'Souvlaki', it: 'Souvlaki' },
  falafel_wrap:  { de: 'Falafel-Wrap', es: 'Wrap de falafel', fr: 'Wrap falafel', it: 'Falafel wrap' },
  churros:       { de: 'Churros', es: 'Churros', fr: 'Churros', it: 'Churros' },
  langos:        { de: 'Langos', es: 'Langos', fr: 'Langos', it: 'Langos' },
  pierogi:       { de: 'Piroggen', es: 'Pierogi', fr: 'Pierogi', it: 'Pierogi' },
  nachos:        { de: 'Nachos', es: 'Nachos', fr: 'Nachos', it: 'Nachos' },
  donut:         { de: 'Donut', es: 'Dónut', fr: 'Donut', it: 'Ciambella' },
  apple_pie:     { de: 'Apfelkuchen', es: 'Tarta de manzana', fr: 'Tarte aux pommes', it: 'Torta di mele' },
  cheesecake:    { de: 'Käsekuchen', es: 'Tarta de queso', fr: 'Cheesecake', it: 'Cheesecake' },
  chili_con_carne:{ de: 'Chili con Carne', es: 'Chili con carne', fr: 'Chili con carne', it: 'Chili con carne' },
  scrambled_eggs:{ de: 'Rührei', es: 'Huevos revueltos', fr: 'Œufs brouillés', it: 'Uova strapazzate' },
  coleslaw:      { de: 'Krautsalat', es: 'Ensalada de col', fr: 'Salade de chou', it: 'Insalata di cavolo' },
  general_tso_chicken:{ de: 'General Tso Hähnchen', es: 'Pollo General Tso', fr: 'Poulet du Général Tao', it: 'Pollo General Tso' },
  lo_mein:       { de: 'Lo Mein', es: 'Lo mein', fr: 'Lo mein', it: 'Lo mein' },
  peking_duck:   { de: 'Peking-Ente', es: 'Pato pekinés', fr: 'Canard laqué', it: 'Anatra alla pechinese' },
  hot_sour_soup: { de: 'Sauer-scharfe Suppe', es: 'Sopa agripicante', fr: 'Soupe aigre-piquante', it: 'Zuppa agropiccante' },
  char_siu:      { de: 'Char Siu (BBQ-Schwein)', es: 'Cerdo char siu', fr: 'Porc char siu', it: 'Maiale char siu' },
  egg_drop_soup: { de: 'Eierblumensuppe', es: 'Sopa de huevo', fr: 'Soupe aux œufs', it: 'Zuppa di uova' },
  salmon_nigiri: { de: 'Sushi — einfach', es: 'Sushi — sencillo', fr: 'Sushi — nature', it: 'Sushi — semplice' },
  california_roll:{ de: 'Sushi — mit Avocado', es: 'Sushi — con aguacate', fr: 'Sushi — avec avocat', it: 'Sushi — con avocado' },
  ramen:         { de: 'Ramen', es: 'Ramen', fr: 'Ramen', it: 'Ramen' },
  teriyaki_chicken:{ de: 'Teriyaki-Hähnchen', es: 'Pollo teriyaki', fr: 'Poulet teriyaki', it: 'Pollo teriyaki' },
  miso_soup:     { de: 'Misosuppe', es: 'Sopa de miso', fr: 'Soupe miso', it: 'Zuppa di miso' },
  edamame:       { de: 'Edamame', es: 'Edamame', fr: 'Édamame', it: 'Edamame' },
  tempura:       { de: 'Tempura', es: 'Tempura', fr: 'Tempura', it: 'Tempura' },
  pad_thai:      { de: 'Pad Thai', es: 'Pad thai', fr: 'Pad thaï', it: 'Pad thai' },
  green_curry:   { de: 'Grünes Thai-Curry', es: 'Curry verde tailandés', fr: 'Curry vert thaï', it: 'Curry verde thai' },
  tom_yum:       { de: 'Tom-Yum-Suppe', es: 'Sopa tom yum', fr: 'Soupe tom yam', it: 'Zuppa tom yum' },
  pho:           { de: 'Pho', es: 'Pho', fr: 'Phở', it: 'Pho' },
  bibimbap:      { de: 'Bibimbap', es: 'Bibimbap', fr: 'Bibimbap', it: 'Bibimbap' },
  bulgogi:       { de: 'Bulgogi', es: 'Bulgogi', fr: 'Bulgogi', it: 'Bulgogi' },
  guacamole:     { de: 'Guacamole', es: 'Guacamole', fr: 'Guacamole', it: 'Guacamole' },
  quesadilla:    { de: 'Quesadilla', es: 'Quesadilla', fr: 'Quesadilla', it: 'Quesadilla' },
  falafel:       { de: 'Falafel', es: 'Falafel', fr: 'Falafel', it: 'Falafel' },
  shakshuka:     { de: 'Schakschuka', es: 'Shakshuka', fr: 'Shakshuka', it: 'Shakshuka' },
  poke_bowl:     { de: 'Poke Bowl', es: 'Poke bowl', fr: 'Poke bowl', it: 'Poke bowl' },
};

// Returns the localized name of a food, falling back to the English name.
function foodName(food, lang) {
  if (!food) return '';
  if (!lang || lang === 'en') return food.name;
  const tr = FOOD_NAMES[food.id];
  return (tr && tr[lang]) ? tr[lang] : food.name;
}

// Localized swap entry { name, why }, falling back to the English swap object.
// Wheat-based dishes: their fructans come (partly) from a wheat base, so a gluten-free
// swap helps. Rice/noodle-rice dishes are deliberately excluded.
const WHEAT_LIGHTEN = new Set([
  'pizza', 'pinsa', 'lasagna', 'spaghetti_bolognese', 'spaghetti_carbonara',
  'tiramisu', 'cheeseburger', 'mac_cheese', 'pancakes', 'club_sandwich', 'bagel_cream_cheese',
  'hot_dog', 'dumplings', 'spring_rolls', 'wonton_soup', 'naan', 'samosa', 'croissant', 'baguette',
  'quiche', 'fish_and_chips', 'pretzel', 'crepe', 'fried_chicken', 'donut', 'apple_pie', 'cheesecake',
  'lo_mein', 'chow_mein', 'ramen', 'tempura', 'schnitzel', 'quesadilla', 'burrito', 'moussaka',
  'buffalo_wings', 'kebab',
]);
const DRIED_FRUIT_LIGHTEN = new Set(['raisins', 'dates', 'dried_apricot', 'prunes', 'dried_fig', 'dried_mango']);
// Sweet / plain-bread dishes whose fructans come from wheat, not onion/garlic — no allium tip.
const NO_ALLIUM_DISH = new Set([
  'pancakes', 'tiramisu', 'croissant', 'baguette', 'pretzel', 'crepe', 'donut', 'apple_pie',
  'cheesecake', 'bagel_cream_cheese', 'naan', 'mac_cheese', 'club_sandwich',
]);

// Which reusable LIGHTEN_TIPS apply to a high-FODMAP food, based on its FODMAP groups
// and food category. Returns an ordered list of tip ids.
function lightenTipIds(food) {
  const g = new Set(food.groups || []);
  const grp = food.group;
  const id = food.id;
  const ids = [];
  if (grp === 'dish') {
    if (g.has('fructans') && !NO_ALLIUM_DISH.has(id)) ids.push('alliums');
    if (WHEAT_LIGHTEN.has(id)) ids.push('wheat');
    if (g.has('lactose')) ids.push('lactose');
    if (g.has('gos')) ids.push('gos');
    if (g.has('fructose')) ids.push('sweet_sauce');
  } else if (grp === 'fruit') {
    if (/juice/.test(id)) ids.push('juice');
    else if (DRIED_FRUIT_LIGHTEN.has(id)) ids.push('dried_fruit');
    else ids.push('fruit_swap');
  } else if (grp === 'drink') {
    if (id === 'soft_drink') ids.push('soft_drink');
    else if (/juice/.test(id)) ids.push('juice');
    else if (id === 'chamomile_tea') ids.push('tea_swap');
  } else if (grp === 'grain') {
    ids.push('cereal_swap');
  } else if (grp === 'dairy') {
    if (id === 'soy_milk') ids.push('soy_milk_swap');
    else if (g.has('lactose')) ids.push('lactose');
  } else if (grp === 'sauce') {
    ids.push('alliums');
  } else if (grp === 'veg') {
    if (g.has('mannitol') || g.has('sorbitol')) ids.push('polyol_veg');
    else if (g.has('fructans')) ids.push('fructan_veg');
  } else {
    if (g.has('lactose')) ids.push('lactose');
    if (g.has('gos')) ids.push('gos');
    if (g.has('fructose')) ids.push('fruit_swap');
    if (g.has('sorbitol') || g.has('mannitol')) ids.push('polyol_veg');
    if (g.has('fructans')) ids.push('alliums');
  }
  if (ids.length === 0) ids.push('portion_generic');
  return ids;
}

// Generated, localized "how to make it low-FODMAP" guidance for a high food that has no
// hand-written LOW_FODMAP_SWAPS entry. Returns an array of { name, why }.
function lightenGuidance(food, lang) {
  const L = (o) => (o && (o[lang] || o.en)) || '';
  return lightenTipIds(food).map(tid => {
    const t = LIGHTEN_TIPS[tid];
    return t ? { name: L(t.name), why: L(t.why) } : null;
  }).filter(Boolean);
}

// Localized FODMAP-group name + description, falling back to the English GROUP_INFO.
function groupInfoText(g, lang) {
  const base = GROUP_INFO[g];
  if (!base) return { name: '', desc: '' };
  if (!lang || lang === 'en') return base;
  const tr = GROUPS_I18N[g] && GROUPS_I18N[g][lang];
  if (!tr) return base;
  return { name: tr.name || base.name, desc: tr.desc || base.desc };
}

function swapText(foodId, index, englishSwap, lang) {
  if (!lang || lang === 'en') return englishSwap;
  const arr = SWAPS_I18N[foodId];
  const tr = arr && arr[index] && arr[index][lang];
  if (!tr) return englishSwap;
  return { name: tr.name || englishSwap.name, why: tr.why || englishSwap.why };
}

// Localized fermentation text/histamineText, falling back to the English note.
function fermentationText(foodId, englishNote, lang) {
  if (!lang || lang === 'en') return englishNote;
  const tr = FERMENTATION_I18N[foodId] && FERMENTATION_I18N[foodId][lang];
  if (!tr) return englishNote;
  return {
    text: tr.text || englishNote.text,
    histamineText: tr.histamineText || englishNote.histamineText,
  };
}

// Localized pattern-engine string with {placeholder} interpolation.
function patternText(key, vars, lang) {
  let str = (lang && lang !== 'en' && PATTERN_I18N[key]) ? PATTERN_I18N[key][lang] : null;
  if (!str) return null; // caller keeps its English fallback
  if (vars) Object.keys(vars).forEach(k => { str = str.replace('{' + k + '}', vars[k]); });
  return str;
}

// Localized recipe title, falling back to the English title.
function recipeTitle(recipe, lang) {
  if (!recipe) return '';
  if (!lang || lang === 'en') return recipe.title;
  const tr = RECIPES_I18N[recipe.id] && RECIPES_I18N[recipe.id][lang];
  return (tr && tr.title) ? tr.title : recipe.title;
}

// Localized recipe steps, falling back to the English steps.
function recipeSteps(recipe, lang) {
  if (!recipe) return '';
  if (!lang || lang === 'en') return recipe.steps;
  const tr = RECIPES_I18N[recipe.id] && RECIPES_I18N[recipe.id][lang];
  return (tr && tr.steps) ? tr.steps : recipe.steps;
}

const FOODS = [
  { id: 'carrot', category: 'vegetables', pieceG: 60, name: 'Carrot', emoji: '🥕', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 5, group: 'veg' },
  { id: 'cucumber', category: 'vegetables', name: 'Cucumber', emoji: '🥒', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 3, group: 'veg' },
  { id: 'potato', category: 'vegetables', pieceG: 150, name: 'Potato', emoji: '🥔', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 8, group: 'veg' },
  { id: 'lettuce', category: 'vegetables', name: 'Lettuce', emoji: '🥬', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 4, group: 'veg' },
  { id: 'kale', category: 'vegetables', name: 'Kale', emoji: '🥬', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 10, group: 'veg' },
  { id: 'pumpkin', category: 'vegetables', name: 'Pumpkin', emoji: '🎃', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 10, group: 'veg' },
  { id: 'olives', category: 'pickles', name: 'Olives', emoji: '🫒', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 5, group: 'veg' },
  { id: 'ginger', category: 'herbs', name: 'Ginger', emoji: '🫚', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 3, group: 'veg' },
  { id: 'spinach', category: 'vegetables', name: 'Baby spinach', emoji: '🥬', cat: 'mod', groups: ['fructans'], lowT: 75, modT: 150, popTrigger: 25, group: 'veg' },
  { id: 'broccoli', category: 'vegetables', name: 'Broccoli', emoji: '🥦', cat: 'mod', groups: ['fructans'], lowT: 75, modT: 150, popTrigger: 45, group: 'veg' },
  { id: 'tomato', category: 'vegetables', name: 'Tomato', emoji: '🍅', cat: 'mod', groups: ['fructose'], lowT: 65, modT: 130, popTrigger: 30, group: 'veg' },
  { id: 'cherry_tomato', category: 'vegetables', name: 'Cherry tomato', emoji: '🍅', cat: 'mod', groups: ['fructose'], lowT: 75, modT: 150, popTrigger: 25, group: 'veg' },
  { id: 'pepper_red', category: 'vegetables', name: 'Bell pepper (red)', emoji: '🫑', cat: 'mod', groups: ['fructans'], lowT: 43, modT: 75, popTrigger: 35, group: 'veg' },
  { id: 'zucchini', category: 'vegetables', name: 'Zucchini', emoji: '🥒', cat: 'mod', groups: ['fructans'], lowT: 65, modT: 130, popTrigger: 30, group: 'veg' },
  { id: 'eggplant', category: 'vegetables', name: 'Eggplant', emoji: '🍆', cat: 'mod', groups: ['sorbitol'], lowT: 75, modT: 180, popTrigger: 35, group: 'veg' },
  { id: 'green_beans', category: 'vegetables', name: 'Green beans', emoji: '🫛', cat: 'mod', groups: ['sorbitol'], lowT: 75, modT: 125, popTrigger: 30, group: 'veg' },
  { id: 'sweet_corn', category: 'vegetables', name: 'Sweet corn', emoji: '🌽', cat: 'mod', groups: ['fructans', 'sorbitol'], lowT: 38, modT: 75, popTrigger: 40, group: 'veg' },
  { id: 'cabbage_white', category: 'vegetables', name: 'Cabbage (white)', emoji: '🥬', cat: 'mod', groups: ['fructans'], lowT: 75, modT: 150, popTrigger: 35, group: 'veg' },
  { id: 'beetroot', category: 'vegetables', name: 'Beetroot', emoji: '🥗', cat: 'mod', groups: ['fructans', 'gos'], lowT: 25, modT: 75, popTrigger: 40, group: 'veg' },
  { id: 'sweet_potato', category: 'vegetables', name: 'Sweet potato', emoji: '🍠', cat: 'mod', groups: ['mannitol'], lowT: 75, modT: 150, popTrigger: 35, group: 'veg' },
  { id: 'onion', category: 'vegetables', name: 'Onion', emoji: '🧅', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 80, group: 'veg' },
  { id: 'shallot', category: 'vegetables', name: 'Shallot', emoji: '🧅', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 78, group: 'veg' },
  { id: 'garlic', category: 'vegetables', name: 'Garlic', emoji: '🧄', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 75, group: 'veg' },
  { id: 'leek', category: 'vegetables', name: 'Leek', emoji: '🧅', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 78, group: 'veg' },
  { id: 'spring_onion', category: 'vegetables', name: 'Spring onion (green tops)', emoji: '🧅', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 12, group: 'veg', alias: 'scallion, green onion, spring onion greens, cipollotto' },
  { id: 'mushroom', category: 'vegetables', name: 'Mushroom', emoji: '🍄', cat: 'high', groups: ['mannitol'], lowT: null, modT: null, popTrigger: 60, group: 'veg', alias: 'champignon, button mushroom, portobello, cremini, chestnut mushroom, shiitake, porcini, funghi, fungo, champignons, steinpilz' },
  { id: 'oyster_mushroom', category: 'vegetables', name: 'Oyster mushroom', emoji: '🍄', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 10, group: 'veg', alias: 'pleurotus, oyster mushroom, funghi ostrica, pleurote, austernpilz, seta de ostra' },
  { id: 'truffle', category: 'vegetables', name: 'Truffle', emoji: '🍄', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 5, group: 'veg', alias: 'tartufo, truffle oil, olio al tartufo, truffe, trueffel, trufa' },
  { id: 'cauliflower', category: 'vegetables', name: 'Cauliflower', emoji: '🥦', cat: 'high', groups: ['mannitol'], lowT: null, modT: null, popTrigger: 65, group: 'veg' },
  { id: 'asparagus_green', category: 'vegetables', name: 'Green asparagus', emoji: '🌿', cat: 'high', groups: ['fructans', 'fructose'], lowT: null, modT: null, popTrigger: 70, group: 'veg' },
  { id: 'celery', category: 'vegetables', name: 'Celery', emoji: '🥬', cat: 'high', groups: ['mannitol'], lowT: null, modT: null, popTrigger: 50, group: 'veg' },
  { id: 'sauerkraut', category: 'fermented', name: 'Sauerkraut', emoji: '🥬', cat: 'mod', groups: ['fructans', 'mannitol'], lowT: 40, modT: 100, popTrigger: 45, group: 'veg', smallPortionOk: true },
  { id: 'kimchi', category: 'fermented', name: 'Kimchi', emoji: '🥬', cat: 'mod', groups: ['fructans'], lowT: 40, modT: 100, popTrigger: 45, group: 'veg', smallPortionOk: true },
  { id: 'blueberry', category: 'fruit', name: 'Blueberry', emoji: '🫐', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 5, group: 'fruit' },
  { id: 'kiwi', category: 'fruit', pieceG: 75, name: 'Kiwi', emoji: '🥝', cat: 'low', groups: [], lowT: 150, modT: null, popTrigger: 8, group: 'fruit' },
  { id: 'orange', category: 'fruit', pieceG: 130, name: 'Orange', emoji: '🍊', cat: 'low', groups: [], lowT: 130, modT: null, popTrigger: 12, group: 'fruit' },
  { id: 'mandarin', category: 'fruit', pieceG: 75, name: 'Mandarin', emoji: '🍊', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 10, group: 'fruit' },
  { id: 'lemon', category: 'fruit', name: 'Lemon', emoji: '🍋', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 8, group: 'fruit' },
  { id: 'pineapple', category: 'fruit', name: 'Pineapple', emoji: '🍍', cat: 'low', groups: [], lowT: 140, modT: null, popTrigger: 15, group: 'fruit' },
  { id: 'raspberry', category: 'fruit', name: 'Raspberry', emoji: '🍓', cat: 'low', groups: [], lowT: 60, modT: null, popTrigger: 12, group: 'fruit' },
  { id: 'strawberry', category: 'fruit', name: 'Strawberry', emoji: '🍓', cat: 'mod', groups: ['fructans'], lowT: 65, modT: 250, popTrigger: 20, group: 'fruit' },
  { id: 'banana_green', category: 'fruit', pieceG: 118, name: 'Green banana', emoji: '🍌', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 5, group: 'fruit', alias: 'unripe banana firm banana' },
  { id: 'banana', category: 'fruit', pieceG: 118, name: 'Ripe banana', emoji: '🍌', cat: 'mod', groups: ['fructans'], lowT: 35, modT: 70, popTrigger: 40, group: 'fruit', alias: 'mature banana' },
  { id: 'mango', category: 'fruit', name: 'Mango', emoji: '🥭', cat: 'mod', groups: ['fructose'], lowT: 40, modT: 80, popTrigger: 40, group: 'fruit' },
  { id: 'grapes', category: 'fruit', name: 'Grapes', emoji: '🍇', cat: 'mod', groups: ['fructose'], lowT: 75, modT: 150, popTrigger: 35, group: 'fruit' },
  { id: 'avocado', category: 'fruit', name: 'Avocado', emoji: '🥑', cat: 'mod', groups: ['sorbitol'], lowT: 30, modT: 80, popTrigger: 30, group: 'fruit' },
  { id: 'apple', category: 'fruit', pieceG: 150, name: 'Apple', emoji: '🍎', cat: 'high', groups: ['fructose', 'sorbitol'], lowT: null, modT: null, popTrigger: 75, group: 'fruit' },
  { id: 'pear', category: 'fruit', pieceG: 170, name: 'Pear', emoji: '🍐', cat: 'high', groups: ['fructose', 'sorbitol'], lowT: null, modT: null, popTrigger: 78, group: 'fruit' },
  { id: 'watermelon', category: 'fruit', name: 'Watermelon', emoji: '🍉', cat: 'high', groups: ['fructose', 'fructans'], lowT: null, modT: null, popTrigger: 65, group: 'fruit' },
  { id: 'peach', category: 'fruit', pieceG: 150, name: 'Peach', emoji: '🍑', cat: 'high', groups: ['fructose', 'sorbitol'], lowT: null, modT: null, popTrigger: 70, group: 'fruit' },
  { id: 'apricot', category: 'fruit', pieceG: 35, name: 'Apricot', emoji: '🍑', cat: 'high', groups: ['sorbitol'], lowT: null, modT: null, popTrigger: 70, group: 'fruit' },
  { id: 'apple_juice', category: 'cold_drinks', name: 'Apple juice', emoji: '🧃', cat: 'high', groups: ['fructose'], lowT: null, modT: null, popTrigger: 80, group: 'fruit' },
  { id: 'cherries', category: 'fruit', name: 'Cherries', emoji: '🍒', cat: 'high', groups: ['fructose', 'sorbitol'], lowT: null, modT: null, popTrigger: 55, group: 'fruit' },
  { id: 'blackberries', category: 'fruit', name: 'Blackberries', emoji: '🫐', cat: 'high', groups: ['sorbitol'], lowT: null, modT: null, popTrigger: 50, group: 'fruit' },
  { id: 'plum', category: 'fruit', pieceG: 65, name: 'Plum', emoji: '🍑', cat: 'high', groups: ['sorbitol'], lowT: null, modT: null, popTrigger: 50, group: 'fruit' },
  { id: 'nectarine', category: 'fruit', pieceG: 140, name: 'Nectarine', emoji: '🍑', cat: 'high', groups: ['sorbitol', 'fructose'], lowT: null, modT: null, popTrigger: 50, group: 'fruit' },
  { id: 'pomegranate', category: 'fruit', name: 'Pomegranate', emoji: '🍎', cat: 'mod', groups: ['fructose'], lowT: 45, modT: 90, popTrigger: 30, group: 'fruit' },
  { id: 'honeydew', category: 'fruit', name: 'Honeydew melon', emoji: '🍈', cat: 'mod', groups: ['fructose'], lowT: 90, modT: 180, popTrigger: 25, group: 'fruit' },
  { id: 'cantaloupe', category: 'fruit', name: 'Cantaloupe melon', emoji: '🍈', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 12, group: 'fruit' },
  { id: 'grapefruit', category: 'fruit', name: 'Grapefruit', emoji: '🍊', cat: 'low', groups: [], lowT: 80, modT: null, popTrigger: 15, group: 'fruit' },
  { id: 'papaya', category: 'fruit', name: 'Papaya', emoji: '🥭', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 12, group: 'fruit' },
  { id: 'passionfruit', category: 'fruit', name: 'Passion fruit', emoji: '🍈', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 10, group: 'fruit' },
  { id: 'raisins', category: 'dried_fruit', name: 'Raisins', emoji: '🍇', cat: 'high', groups: ['fructose', 'fructans'], lowT: null, modT: null, popTrigger: 55, group: 'fruit', alias: 'sultanas dried grapes' },
  { id: 'dates', category: 'dried_fruit', name: 'Dates', emoji: '🌰', cat: 'high', groups: ['fructans', 'fructose'], lowT: null, modT: null, popTrigger: 60, group: 'fruit' },
  { id: 'dried_apricot', category: 'dried_fruit', name: 'Dried apricots', emoji: '🍑', cat: 'high', groups: ['sorbitol'], lowT: null, modT: null, popTrigger: 55, group: 'fruit' },
  { id: 'prunes', category: 'dried_fruit', name: 'Prunes', emoji: '🍑', cat: 'high', groups: ['sorbitol'], lowT: null, modT: null, popTrigger: 65, group: 'fruit', alias: 'dried plums' },
  { id: 'dried_fig', category: 'dried_fruit', name: 'Dried figs', emoji: '🌰', cat: 'high', groups: ['fructose', 'fructans'], lowT: null, modT: null, popTrigger: 55, group: 'fruit' },
  { id: 'dried_mango', category: 'dried_fruit', name: 'Dried mango', emoji: '🥭', cat: 'high', groups: ['fructose'], lowT: null, modT: null, popTrigger: 50, group: 'fruit' },
  { id: 'dried_cranberry', category: 'dried_fruit', name: 'Dried cranberries', emoji: '🍒', cat: 'mod', groups: ['fructose'], lowT: 13, modT: 30, popTrigger: 40, group: 'fruit', alias: 'craisins' },
  { id: 'rice', category: 'grains', name: 'White rice', emoji: '🍚', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 3, group: 'grain' },
  { id: 'rice_brown', category: 'grains', name: 'Brown rice', emoji: '🍚', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 8, group: 'grain' },
  { id: 'quinoa', category: 'grains', name: 'Quinoa', emoji: '🌾', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 5, group: 'grain' },
  { id: 'buckwheat', category: 'grains', name: 'Buckwheat', emoji: '🌾', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 5, group: 'grain' },
  { id: 'rice_noodle', category: 'grains', name: 'Rice noodles', emoji: '🍜', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 5, group: 'grain', portions: { S: 50, M: 100, L: 150, unit: 'g' } },
  { id: 'gluten_free_bread', category: 'bread', name: 'Gluten-free bread', emoji: '🍞', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 10, group: 'grain' },
  { id: 'gluten_free_pasta', category: 'grains', name: 'Gluten-free pasta', emoji: '🍝', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 10, group: 'grain', portions: { S: 50, M: 100, L: 150, unit: 'g' } },
  { id: 'oats', category: 'cereal', name: 'Rolled oats', emoji: '🥣', cat: 'mod', groups: ['fructans', 'gos'], lowT: 60, modT: 100, popTrigger: 35, group: 'grain' },
  { id: 'pasta', category: 'grains', name: 'Wheat pasta', emoji: '🍝', cat: 'mod', groups: ['fructans'], lowT: 74, modT: 150, popTrigger: 55, group: 'grain', portions: { S: 50, M: 100, L: 150, unit: 'g' } },
  { id: 'sourdough_spelt', category: 'bread', name: 'Spelt sourdough', emoji: '🍞', cat: 'mod', groups: ['fructans'], lowT: 26, modT: 80, popTrigger: 35, group: 'grain' },
  { id: 'bread', category: 'bread', name: 'Wheat bread', emoji: '🍞', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 70, group: 'grain' },
  { id: 'pizza_dough', category: 'bread', name: 'Pizza dough', emoji: '🫓', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 70, group: 'grain' },
  // Generic wheat flatbread — the shared base for wraps/flatbread dishes (kebab, gyros, souvlaki,
  // falafel wrap, langos, burrito, quesadilla). Same flat-high fructan profile as wheat bread.
  { id: 'flatbread', category: 'bread', name: 'Flatbread', emoji: '🫓', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 70, group: 'grain', alias: 'pita wrap naan lavash doner kebab bread wheat tortilla' },
  // Corn (maize/masa) tortilla — nixtamalised corn is LOW FODMAP, unlike sweet-corn kernels, so
  // this replaces the sweet_corn proxy in corn-tortilla dishes (tacos, nachos, arepa).
  { id: 'corn_tortilla', category: 'bread', name: 'Corn tortilla', emoji: '🫓', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 8, group: 'grain', alias: 'maize tortilla taco masa mais nachos' },
  // Pinsa dough is a wheat/rice/soy blend with high hydration and long (24-72h) cold
  // fermentation, which breaks down much of the fructans — like sourdough. Thresholds are
  // sized to a MEAL portion (a whole pinsa ≈ 180g dough, see DISH_INGREDIENTS), not a bread
  // slice: ≤90g (½ pinsa) low, ≤200g (a normal pinsa) moderate, larger high. This makes a
  // logged pinsa read gentler than pizza (whose dough is flat 'high') at normal servings.
  { id: 'pinsa_dough', category: 'bread', name: 'Pinsa dough', emoji: '🫓', cat: 'mod', groups: ['fructans'], lowT: 90, modT: 200, popTrigger: 35, group: 'grain', alias: 'pinsa romana dough' },
  { id: 'rye_bread', category: 'bread', name: 'Rye bread', emoji: '🍞', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 70, group: 'grain' },
  { id: 'brotchen', category: 'bread', name: 'Bread roll', emoji: '🥖', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 70, group: 'grain' },
  { id: 'whole_wheat_bread', category: 'bread', name: 'Whole wheat bread', emoji: '🍞', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 75, group: 'grain' },
  { id: 'spatzle', category: 'grains', name: 'Spätzle', emoji: '🍝', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 65, group: 'grain' },
  { id: 'cornflakes', category: 'cereal', name: 'Cornflakes', emoji: '🥣', cat: 'low', groups: [], lowT: 30, modT: null, popTrigger: 20, group: 'grain' },
  { id: 'muesli', category: 'cereal', name: 'Muesli', emoji: '🥣', cat: 'high', groups: ['fructans', 'fructose'], lowT: null, modT: null, popTrigger: 55, group: 'grain' },
  { id: 'granola', category: 'cereal', name: 'Granola', emoji: '🥣', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 55, group: 'grain' },
  { id: 'bran_cereal', category: 'cereal', name: 'Bran cereal', emoji: '🥣', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 60, group: 'grain', alias: 'wheat bran all bran' },
  { id: 'milk_lf', category: 'dairy_liquid', name: 'Lactose-free milk', emoji: '🥛', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 8, group: 'dairy' },
  { id: 'almond_milk', category: 'dairy_liquid', name: 'Almond milk', emoji: '🥛', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 5, group: 'dairy' },
  { id: 'cheddar', category: 'dairy_solid', name: 'Cheddar', emoji: '🧀', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 10, group: 'dairy' },
  { id: 'parmesan', category: 'dairy_solid', name: 'Parmesan', emoji: '🧀', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 8, group: 'dairy' },
  { id: 'mozzarella', category: 'dairy_solid', name: 'Mozzarella', emoji: '🧀', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 12, group: 'dairy' },
  { id: 'feta', category: 'dairy_solid', name: 'Feta', emoji: '🧀', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 12, group: 'dairy' },
  { id: 'butter', category: 'condiments', name: 'Butter', emoji: '🧈', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 5, group: 'dairy' },
  { id: 'lactose_free_yogurt', category: 'dairy_liquid', name: 'Lactose-free yogurt', emoji: '🥛', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 10, group: 'dairy' },
  { id: 'cream_cheese', category: 'dairy_solid', name: 'Frischkäse', emoji: '🧀', cat: 'mod', groups: ['lactose'], lowT: 40, modT: 80, popTrigger: 35, group: 'dairy' },
  { id: 'quark', category: 'dairy_solid', name: 'Quark', emoji: '🥛', cat: 'mod', groups: ['lactose'], lowT: 40, modT: 80, popTrigger: 40, group: 'dairy' },
  { id: 'oat_milk', category: 'dairy_liquid', name: 'Oat milk', emoji: '🥛', cat: 'mod', groups: ['fructans', 'gos'], lowT: 104, modT: 250, popTrigger: 25, group: 'dairy' },
  { id: 'soy_milk', category: 'dairy_liquid', name: 'Soy milk', emoji: '🥛', cat: 'high', groups: ['gos'], lowT: null, modT: null, popTrigger: 40, group: 'dairy', alias: 'soya milk' },
  { id: 'milk', category: 'dairy_liquid', name: "Cow's milk", emoji: '🥛', cat: 'high', groups: ['lactose'], lowT: null, modT: null, popTrigger: 70, group: 'dairy' },
  { id: 'yogurt', category: 'dairy_liquid', name: 'Yogurt', emoji: '🥛', cat: 'high', groups: ['lactose'], lowT: null, modT: null, popTrigger: 65, group: 'dairy' },
  { id: 'greek_yogurt', category: 'dairy_liquid', name: 'Greek yogurt', emoji: '🥛', cat: 'mod', groups: ['lactose'], lowT: 60, modT: 170, popTrigger: 45, group: 'dairy', fermented: true },
  { id: 'skyr', category: 'dairy_liquid', name: 'Skyr', emoji: '🥛', cat: 'mod', groups: ['lactose'], lowT: 60, modT: 170, popTrigger: 40, group: 'dairy', fermented: true },
  { id: 'kefir', category: 'dairy_liquid', name: 'Kefir', emoji: '🥛', cat: 'high', groups: ['lactose'], lowT: null, modT: null, popTrigger: 70, group: 'dairy', fermented: true },
  { id: 'brie', category: 'dairy_solid', name: 'Brie', emoji: '🧀', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 12, group: 'dairy' },
  { id: 'camembert', category: 'dairy_solid', name: 'Camembert', emoji: '🧀', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 12, group: 'dairy' },
  { id: 'swiss_cheese', category: 'dairy_solid', name: 'Swiss cheese', emoji: '🧀', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 10, group: 'dairy' },
  { id: 'gouda', category: 'dairy_solid', name: 'Gouda', emoji: '🧀', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 10, group: 'dairy' },
  { id: 'gruyere', category: 'dairy_solid', name: 'Gruyère', emoji: '🧀', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 10, group: 'dairy' },
  { id: 'provolone', category: 'dairy_solid', name: 'Provolone', emoji: '🧀', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 12, group: 'dairy' },
  { id: 'pecorino', category: 'dairy_solid', name: 'Pecorino', emoji: '🧀', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 10, group: 'dairy' },
  { id: 'goat_cheese', category: 'dairy_solid', name: 'Goat cheese', emoji: '🧀', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 14, group: 'dairy' },
  { id: 'blue_cheese', category: 'dairy_solid', name: 'Blue cheese', emoji: '🧀', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 14, group: 'dairy' },
  { id: 'halloumi', category: 'dairy_solid', name: 'Halloumi', emoji: '🧀', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 14, group: 'dairy' },
  { id: 'ricotta', category: 'dairy_solid', name: 'Ricotta', emoji: '🧀', cat: 'mod', groups: ['lactose'], lowT: 40, modT: 80, popTrigger: 30, group: 'dairy' },
  { id: 'burrata', category: 'dairy_solid', name: 'Burrata', emoji: '🧀', cat: 'mod', groups: ['lactose'], lowT: 30, modT: 60, popTrigger: 30, group: 'dairy' },
  { id: 'cottage_cheese', category: 'dairy_solid', name: 'Cottage cheese', emoji: '🧀', cat: 'high', groups: ['lactose'], lowT: null, modT: null, popTrigger: 55, group: 'dairy' },
  { id: 'cream', category: 'dairy_liquid', name: 'Cream', emoji: '🥛', cat: 'mod', groups: ['lactose'], lowT: 40, modT: 90, popTrigger: 30, group: 'dairy', alias: 'panna sahne obers heavy whipping cooking cream' },
  { id: 'creme_fraiche', category: 'dairy_solid', name: 'Crème fraîche', emoji: '🥛', cat: 'mod', groups: ['lactose'], lowT: 40, modT: 90, popTrigger: 30, group: 'dairy', fermented: true, alias: 'creme fraiche' },
  { id: 'sour_cream', category: 'dairy_solid', name: 'Sour cream', emoji: '🥛', cat: 'mod', groups: ['lactose'], lowT: 40, modT: 90, popTrigger: 30, group: 'dairy', fermented: true, alias: 'schmand sauerrahm saure sahne smetana panna acida crema agria' },
  { id: 'mascarpone', category: 'dairy_solid', name: 'Mascarpone', emoji: '🧀', cat: 'mod', groups: ['lactose'], lowT: 40, modT: 80, popTrigger: 30, group: 'dairy', alias: 'mascarpone' },
  { id: 'chicken', category: 'protein', name: 'Chicken', emoji: '🍗', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 2, group: 'protein' },
  { id: 'turkey', category: 'protein', name: 'Turkey', emoji: '🦃', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 3, group: 'protein' },
  { id: 'beef', category: 'protein', name: 'Beef', emoji: '🥩', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 3, group: 'protein' },
  { id: 'pork', category: 'protein', name: 'Pork', emoji: '🥩', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 4, group: 'protein' },
  { id: 'salmon', category: 'protein', name: 'Salmon', emoji: '🐟', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 2, group: 'protein' },
  { id: 'tuna', category: 'protein', name: 'Tuna', emoji: '🐟', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 3, group: 'protein' },
  { id: 'shrimp', category: 'protein', name: 'Shrimp', emoji: '🦐', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 5, group: 'protein' },
  { id: 'egg', category: 'eggs', name: 'Egg', emoji: '🥚', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 4, group: 'protein' },
  { id: 'tofu', category: 'protein', name: 'Tofu (firm)', emoji: '🍱', cat: 'low', groups: [], lowT: 170, modT: null, popTrigger: 10, group: 'protein' },
  { id: 'tofu_silken', category: 'protein', name: 'Tofu (silken)', emoji: '🍱', cat: 'high', groups: ['gos'], lowT: null, modT: null, popTrigger: 20, group: 'protein', alias: 'soft tofu silk' },
  { id: 'tempeh', category: 'protein', name: 'Tempeh', emoji: '🍱', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 15, group: 'protein', alias: 'fermented soybean' },
  { id: 'seitan', category: 'protein', name: 'Seitan', emoji: '🍱', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 18, group: 'protein', alias: 'wheat gluten wheat meat' },
  { id: 'plant_patty', category: 'protein', name: 'Plant-based patty', emoji: '🌱', cat: 'mod', groups: ['gos'], lowT: 60, modT: 130, popTrigger: 20, group: 'protein', alias: 'veggie burger patty beyond impossible soy pea' },
  { id: 'bratwurst', category: 'processed_meat', name: 'Bratwurst', emoji: '🌭', cat: 'mod', groups: ['fructans'], lowT: 100, modT: 200, popTrigger: 35, group: 'protein' },
  { id: 'currywurst', category: 'processed_meat', name: 'Currywurst', emoji: '🌭', cat: 'mod', groups: ['fructans'], lowT: 50, modT: 100, popTrigger: 50, group: 'protein' },
  { id: 'lamb', category: 'protein', name: 'Lamb', emoji: '🥩', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 3, group: 'protein' },
  { id: 'veal', category: 'protein', name: 'Veal', emoji: '🥩', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 3, group: 'protein' },
  { id: 'duck', category: 'protein', name: 'Duck', emoji: '🦆', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 4, group: 'protein' },
  { id: 'ground_beef', category: 'protein', name: 'Ground beef', emoji: '🥩', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 4, group: 'protein' },
  { id: 'bacon', category: 'processed_meat', name: 'Bacon', emoji: '🥓', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 10, group: 'protein', alias: 'pancetta' },
  { id: 'ham', category: 'processed_meat', name: 'Ham', emoji: '🍖', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 8, group: 'protein', alias: 'cooked ham deli ham' },
  { id: 'prosciutto', category: 'processed_meat', name: 'Prosciutto', emoji: '🍖', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 8, group: 'protein', alias: 'speck bresaola coppa parma ham raw ham' },
  { id: 'salami', category: 'processed_meat', name: 'Salami', emoji: '🍖', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 12, group: 'protein', alias: 'mortadella pepperoni chorizo cured sausage' },
  { id: 'white_fish', category: 'protein', name: 'White fish', emoji: '🐟', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 2, group: 'protein', alias: 'cod sea bass sole haddock plaice trout hake pollock whitefish' },
  { id: 'oily_fish', category: 'protein', name: 'Oily fish', emoji: '🐟', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 4, group: 'protein', alias: 'mackerel sardines anchovies herring tinned fish canned fish' },
  { id: 'shellfish', category: 'protein', name: 'Shellfish', emoji: '🦐', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 5, group: 'protein', alias: 'prawns crab lobster mussels scallops clams oysters seafood' },
  // Combined low-FODMAP meats for dishes that are commonly made with either meat (kebab =
  // lamb or chicken, etc.). Both options are low-FODMAP so the verdict is identical; the
  // label just avoids pinning the dish to one meat. dishOnly → hidden from the food search.
  { id: 'meat_lamb_chicken', category: 'protein', name: 'Lamb or chicken', emoji: '🥩', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 99, group: 'protein', dishOnly: true },
  { id: 'meat_beef_pork', category: 'protein', name: 'Beef or pork', emoji: '🥩', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 99, group: 'protein', dishOnly: true },
  { id: 'meat_veal_pork', category: 'protein', name: 'Veal or pork', emoji: '🥩', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 99, group: 'protein', dishOnly: true },
  { id: 'meat_beef_chicken', category: 'protein', name: 'Beef or chicken', emoji: '🥩', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 99, group: 'protein', dishOnly: true },
  { id: 'meat_pork_chicken', category: 'protein', name: 'Pork or chicken', emoji: '🥩', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 99, group: 'protein', dishOnly: true },
  { id: 'lentils', category: 'legumes', name: 'Lentils', emoji: '🫘', cat: 'mod', groups: ['gos'], lowT: 46, modT: 100, popTrigger: 50, group: 'legume' },
  { id: 'chickpeas', category: 'legumes', name: 'Chickpeas', emoji: '🫘', cat: 'mod', groups: ['gos'], lowT: 42, modT: 95, popTrigger: 55, group: 'legume' },
  { id: 'kidney_beans', category: 'legumes', name: 'Kidney beans', emoji: '🫘', cat: 'high', groups: ['gos', 'fructans'], lowT: null, modT: null, popTrigger: 70, group: 'legume' },
  { id: 'peanuts', category: 'nuts_seeds', name: 'Peanuts', emoji: '🥜', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 8, group: 'nut' },
  { id: 'walnuts', category: 'nuts_seeds', name: 'Walnuts', emoji: '🌰', cat: 'low', groups: [], lowT: 30, modT: null, popTrigger: 10, group: 'nut' },
  { id: 'pumpkin_seeds', category: 'nuts_seeds', name: 'Pumpkin seeds (Kürbiskerne)', emoji: '🌰', cat: 'low', groups: [], lowT: 23, modT: null, popTrigger: 10, group: 'nut' },
  { id: 'sunflower_seeds', category: 'nuts_seeds', name: 'Sunflower seeds', emoji: '🌻', cat: 'low', groups: [], lowT: 6, modT: null, popTrigger: 12, group: 'nut' },
  { id: 'chia_seeds', category: 'nuts_seeds', name: 'Chia seeds', emoji: '🌱', cat: 'low', groups: [], lowT: 24, modT: null, popTrigger: 8, group: 'nut' },
  { id: 'sesame_seeds', category: 'nuts_seeds', name: 'Sesame seeds', emoji: '🌱', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 6, group: 'nut' },
  { id: 'flaxseed', category: 'nuts_seeds', name: 'Flaxseed', emoji: '🌱', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 6, group: 'nut', alias: 'linseed' },
  { id: 'poppy_seeds', category: 'nuts_seeds', name: 'Poppy seeds', emoji: '🌱', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 5, group: 'nut' },
  { id: 'hemp_seeds', category: 'nuts_seeds', name: 'Hemp seeds', emoji: '🌱', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 6, group: 'nut' },
  { id: 'almonds', category: 'nuts_seeds', name: 'Almonds', emoji: '🌰', cat: 'mod', groups: ['gos'], lowT: 12, modT: 24, popTrigger: 25, group: 'nut' },
  { id: 'hazelnuts', category: 'nuts_seeds', name: 'Haselnüsse', emoji: '🌰', cat: 'mod', groups: ['gos'], lowT: 15, modT: 30, popTrigger: 25, group: 'nut' },
  { id: 'cashews', category: 'nuts_seeds', name: 'Cashews', emoji: '🌰', cat: 'high', groups: ['gos', 'fructans'], lowT: null, modT: null, popTrigger: 65, group: 'nut' },
  { id: 'maple', category: 'sweeteners', name: 'Maple syrup', emoji: '🍁', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 5, group: 'sweet' },
  { id: 'sugar', category: 'sweeteners', name: 'White sugar', emoji: '🍬', cat: 'low', groups: [], lowT: 50, modT: null, popTrigger: 5, group: 'sweet' },
  { id: 'dark_chocolate', category: 'sweets', name: 'Dark chocolate (85%)', emoji: '🍫', cat: 'low', groups: [], lowT: 30, modT: null, popTrigger: 12, group: 'sweet' },
  { id: 'milk_chocolate', category: 'sweets', name: 'Milk chocolate', emoji: '🍫', cat: 'mod', groups: ['lactose'], lowT: 20, modT: 40, popTrigger: 40, group: 'sweet' },
  { id: 'honey', category: 'sweeteners', name: 'Honey', emoji: '🍯', cat: 'high', groups: ['fructose'], lowT: null, modT: null, popTrigger: 60, group: 'sweet' },
  { id: 'agave', category: 'sweeteners', name: 'Agave syrup', emoji: '🍯', cat: 'high', groups: ['fructose'], lowT: null, modT: null, popTrigger: 65, group: 'sweet' },
  { id: 'olive_oil', category: 'condiments', name: 'Olive oil', emoji: '🫒', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 3, group: 'sauce' },
  { id: 'garlic_oil', category: 'condiments', name: 'Garlic-infused oil', emoji: '🫒', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 8, group: 'sauce' },
  { id: 'soy_sauce', category: 'sauces', name: 'Soy sauce', emoji: '🥢', cat: 'low', groups: [], lowT: 42, modT: null, popTrigger: 15, group: 'sauce' },
  { id: 'mustard', category: 'condiments', name: 'Mustard', emoji: '🟡', cat: 'low', groups: [], lowT: 30, modT: null, popTrigger: 10, group: 'sauce' },
  { id: 'mayo', category: 'condiments', name: 'Mayonnaise', emoji: '🥚', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 8, group: 'sauce' },
  { id: 'pesto', category: 'sauces', name: 'Basil pesto (no garlic)', emoji: '🌿', cat: 'low', groups: [], lowT: 10, modT: 30, popTrigger: 30, group: 'sauce' },
  { id: 'pesto_garlic', category: 'sauces', name: 'Basil pesto (with garlic)', emoji: '🌿', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 50, group: 'sauce' },
  { id: 'pasta_sauce', category: 'sauces', name: 'Tomato pasta sauce (with onion/garlic)', emoji: '🍅', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 80, group: 'sauce' },
  { id: 'pasta_sauce_plain', category: 'sauces', name: 'Tomato pasta sauce (no onion/garlic)', emoji: '🍅', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 15, group: 'sauce' },
  { id: 'hummus', category: 'spreads', name: 'Hummus', emoji: '🥣', cat: 'high', groups: ['gos', 'fructans'], lowT: null, modT: null, popTrigger: 65, group: 'sauce' },
  // Common table / kebab / dip sauces. Garlic- and onion-based ones are high (fructans);
  // yogurt-based carry lactose; the rest are low in normal amounts with a portion threshold.
  { id: 'ketchup', category: 'sauces', name: 'Ketchup', emoji: '🍅', cat: 'low', groups: [], lowT: 40, modT: 100, popTrigger: 20, group: 'sauce', alias: 'tomato ketchup catsup' },
  { id: 'garlic_sauce', category: 'sauces', name: 'Garlic sauce', emoji: '🧄', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 40, group: 'sauce', alias: 'toum aioli garlic mayo garlic dip kebab sauce' },
  { id: 'yogurt_sauce', category: 'sauces', name: 'Yogurt sauce', emoji: '🥛', cat: 'mod', groups: ['lactose'], lowT: 40, modT: 100, popTrigger: 35, group: 'sauce', alias: 'mint yogurt herb yogurt raita labneh sauce' },
  { id: 'tzatziki', category: 'sauces', name: 'Tzatziki', emoji: '🥒', cat: 'high', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 40, group: 'sauce', alias: 'cacik cucumber yogurt garlic sauce' },
  { id: 'hot_sauce', category: 'sauces', name: 'Hot sauce (chilli)', emoji: '🌶️', cat: 'low', groups: [], lowT: 40, modT: null, popTrigger: 20, group: 'sauce', alias: 'tabasco chilli sauce harissa pepper sauce spicy sauce' },
  { id: 'sriracha', category: 'sauces', name: 'Sriracha', emoji: '🌶️', cat: 'mod', groups: ['fructans'], lowT: 20, modT: 45, popTrigger: 30, group: 'sauce', alias: 'chilli garlic sauce' },
  { id: 'bbq_sauce', category: 'sauces', name: 'BBQ sauce', emoji: '🍖', cat: 'low', groups: [], lowT: 40, modT: 100, popTrigger: 30, group: 'sauce', alias: 'barbecue sauce' },
  { id: 'sweet_chili', category: 'sauces', name: 'Sweet chilli sauce', emoji: '🌶️', cat: 'low', groups: [], lowT: 40, modT: 100, popTrigger: 25, group: 'sauce', alias: 'sweet chili thai dipping sauce' },
  { id: 'tahini', category: 'spreads', name: 'Tahini', emoji: '🥣', cat: 'low', groups: [], lowT: 40, modT: null, popTrigger: 25, group: 'sauce', alias: 'sesame paste' },
  { id: 'salsa', category: 'sauces', name: 'Salsa', emoji: '🍅', cat: 'mod', groups: ['fructans'], lowT: 20, modT: 50, popTrigger: 30, group: 'sauce', alias: 'pico de gallo tomato salsa dip' },
  { id: 'water', category: 'cold_drinks', name: 'Water', emoji: '💧', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 0, group: 'drink' },
  { id: 'coffee', category: 'hot_drinks', name: 'Coffee', emoji: '☕', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 25, group: 'drink' },
  { id: 'tea_green', category: 'hot_drinks', name: 'Green tea', emoji: '🍵', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 8, group: 'drink' },
  { id: 'tea_peppermint', category: 'hot_drinks', name: 'Peppermint tea', emoji: '🍵', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 5, group: 'drink' },
  { id: 'beer', category: 'cold_drinks', name: 'Beer', emoji: '🍺', cat: 'low', groups: [], lowT: 375, modT: null, popTrigger: 35, group: 'drink' },
  { id: 'wine_white', category: 'cold_drinks', name: 'White wine', emoji: '🍷', cat: 'low', groups: [], lowT: 150, modT: null, popTrigger: 30, group: 'drink' },
  { id: 'wine_red', category: 'cold_drinks', name: 'Red wine', emoji: '🍷', cat: 'low', groups: [], lowT: 150, modT: null, popTrigger: 35, group: 'drink' },
  { id: 'black_tea', category: 'hot_drinks', name: 'Black tea', emoji: '🍵', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 8, group: 'drink' },
  { id: 'orange_juice', category: 'cold_drinks', name: 'Orange juice', emoji: '🧃', cat: 'mod', groups: ['fructose'], lowT: 100, modT: 200, popTrigger: 30, group: 'drink' },
  { id: 'pear_juice', category: 'cold_drinks', name: 'Pear juice', emoji: '🧃', cat: 'high', groups: ['fructose', 'sorbitol'], lowT: null, modT: null, popTrigger: 60, group: 'drink' },
  { id: 'soft_drink', category: 'cold_drinks', name: 'Soft drink', emoji: '🥤', cat: 'high', groups: ['fructose'], lowT: null, modT: null, popTrigger: 50, group: 'drink', alias: 'soda cola lemonade fizzy pop' },
  { id: 'coconut_water', category: 'cold_drinks', name: 'Coconut water', emoji: '🥥', cat: 'mod', groups: ['sorbitol', 'fructose'], lowT: 100, modT: 250, popTrigger: 25, group: 'drink' },
  { id: 'chamomile_tea', category: 'hot_drinks', name: 'Chamomile tea', emoji: '🍵', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 20, group: 'drink' },
  { id: 'fennel_tea', category: 'hot_drinks', name: 'Fennel tea', emoji: '🍵', cat: 'mod', groups: ['fructans'], lowT: 100, modT: 200, popTrigger: 15, group: 'drink' },
  // ──── PREPARED DISHES ────
  // Most contain wheat, onion, garlic, or dairy and are HIGH FODMAP unless made carefully.
  // Italian
  { id: 'pizza', category: 'prepared_dish', name: 'Pizza Margherita (plain)', emoji: '🍕', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 78, group: 'dish', base: true },
  { id: 'pinsa', category: 'prepared_dish', name: 'Pinsa (plain)', emoji: '🍕', cat: 'mod', groups: ['fructans'], lowT: null, modT: null, popTrigger: 50, group: 'dish', base: true, alias: 'pinsa romana' },
  { id: 'lasagna', category: 'prepared_dish', name: 'Lasagna', emoji: '🍝', cat: 'high', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 80, group: 'dish' },
  { id: 'spaghetti_bolognese', category: 'prepared_dish', name: 'Spaghetti bolognese', emoji: '🍝', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 78, group: 'dish' },
  { id: 'spaghetti_carbonara', category: 'prepared_dish', name: 'Spaghetti carbonara', emoji: '🍝', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 75, group: 'dish' },
  { id: 'risotto', category: 'prepared_dish', name: 'Risotto (plain)', emoji: '🍚', cat: 'high', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 60, group: 'dish', base: true },
  { id: 'caprese_salad', category: 'vegetables', name: 'Caprese salad', emoji: '🥗', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 15, group: 'dish' },
  { id: 'minestrone', category: 'soups', name: 'Minestrone soup', emoji: '🍲', cat: 'high', groups: ['fructans', 'gos'], lowT: null, modT: null, popTrigger: 75, group: 'dish' },
  { id: 'tiramisu', category: 'desserts', name: 'Tiramisu', emoji: '🍰', cat: 'high', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 70, group: 'dish' },
  // US / American
  { id: 'cheeseburger', category: 'prepared_dish', name: 'Cheeseburger', emoji: '🍔', cat: 'high', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 75, group: 'dish' },
  { id: 'french_fries', category: 'prepared_dish', name: 'French fries', emoji: '🍟', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 20, group: 'dish' },
  { id: 'hot_dog', category: 'prepared_dish', name: 'Hot dog', emoji: '🌭', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 65, group: 'dish' },
  { id: 'mac_cheese', category: 'prepared_dish', name: 'Mac and cheese', emoji: '🧀', cat: 'high', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 80, group: 'dish' },
  { id: 'pancakes', category: 'prepared_dish', name: 'Pancakes', emoji: '🥞', cat: 'high', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 60, group: 'dish' },
  { id: 'club_sandwich', category: 'prepared_dish', name: 'Club sandwich', emoji: '🥪', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 60, group: 'dish' },
  { id: 'caesar_salad', category: 'prepared_dish', name: 'Caesar salad', emoji: '🥗', cat: 'high', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 55, group: 'dish' },
  { id: 'bagel_cream_cheese', category: 'prepared_dish', name: 'Bagel with cream cheese', emoji: '🥯', cat: 'high', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 75, group: 'dish' },
  { id: 'bbq_ribs', category: 'prepared_dish', name: 'BBQ ribs', emoji: '🍖', cat: 'high', groups: ['fructans', 'fructose'], lowT: null, modT: null, popTrigger: 60, group: 'dish' },
  { id: 'buffalo_wings', category: 'prepared_dish', name: 'Buffalo wings', emoji: '🍗', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 55, group: 'dish' },
  { id: 'cobb_salad', category: 'prepared_dish', name: 'Cobb salad', emoji: '🥗', cat: 'mod', groups: ['lactose'], lowT: null, modT: null, popTrigger: 40, group: 'dish' },
  // Chinese
  { id: 'fried_rice', category: 'prepared_dish', name: 'Fried rice', emoji: '🍚', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 65, group: 'dish' },
  { id: 'kung_pao_chicken', category: 'prepared_dish', name: 'Kung pao chicken', emoji: '🍗', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 70, group: 'dish' },
  { id: 'sweet_sour_pork', category: 'prepared_dish', name: 'Sweet and sour pork', emoji: '🥩', cat: 'high', groups: ['fructans', 'fructose'], lowT: null, modT: null, popTrigger: 75, group: 'dish' },
  { id: 'chow_mein', category: 'prepared_dish', name: 'Chow mein', emoji: '🍜', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 78, group: 'dish' },
  { id: 'spring_rolls', category: 'prepared_dish', name: 'Spring rolls', emoji: '🥟', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 70, group: 'dish' },
  { id: 'dumplings', category: 'prepared_dish', name: 'Dumplings (pork)', emoji: '🥟', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 70, group: 'dish' },
  { id: 'mapo_tofu', category: 'prepared_dish', name: 'Mapo tofu', emoji: '🍱', cat: 'high', groups: ['fructans', 'gos'], lowT: null, modT: null, popTrigger: 75, group: 'dish' },
  { id: 'wonton_soup', category: 'soups', name: 'Wonton soup', emoji: '🍜', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 70, group: 'dish' },
  { id: 'beef_broccoli', category: 'prepared_dish', name: 'Beef and broccoli', emoji: '🥦', cat: 'mod', groups: ['fructans'], lowT: null, modT: null, popTrigger: 45, group: 'dish' },
  { id: 'steamed_dumplings_shrimp', category: 'prepared_dish', name: 'Shrimp dumplings (har gow)', emoji: '🥟', cat: 'mod', groups: ['fructans'], lowT: null, modT: null, popTrigger: 50, group: 'dish' },
  // Indian
  { id: 'butter_chicken', category: 'prepared_dish', name: 'Butter chicken', emoji: '🍗', cat: 'high', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 75, group: 'dish' },
  { id: 'chicken_tikka_masala', category: 'prepared_dish', name: 'Chicken tikka masala', emoji: '🍗', cat: 'high', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 78, group: 'dish' },
  { id: 'palak_paneer', category: 'prepared_dish', name: 'Palak paneer', emoji: '🥬', cat: 'high', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 75, group: 'dish' },
  { id: 'dal_lentil', category: 'prepared_dish', name: 'Dal (lentil curry)', emoji: '🫘', cat: 'high', groups: ['gos', 'fructans'], lowT: null, modT: null, popTrigger: 80, group: 'dish' },
  { id: 'chana_masala', category: 'prepared_dish', name: 'Chana masala', emoji: '🫘', cat: 'high', groups: ['gos', 'fructans'], lowT: null, modT: null, popTrigger: 82, group: 'dish' },
  { id: 'naan', category: 'bread', name: 'Naan bread', emoji: '🫓', cat: 'high', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 78, group: 'dish' },
  { id: 'samosa', category: 'prepared_dish', name: 'Samosa', emoji: '🥟', cat: 'high', groups: ['fructans', 'gos'], lowT: null, modT: null, popTrigger: 75, group: 'dish' },
  { id: 'biryani', category: 'prepared_dish', name: 'Chicken biryani', emoji: '🍚', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 70, group: 'dish' },
  { id: 'tandoori_chicken', category: 'prepared_dish', name: 'Tandoori chicken', emoji: '🍗', cat: 'mod', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 50, group: 'dish' },
  { id: 'aloo_gobi', category: 'prepared_dish', name: 'Aloo gobi', emoji: '🥔', cat: 'high', groups: ['fructans', 'mannitol'], lowT: null, modT: null, popTrigger: 75, group: 'dish' },
  { id: 'raita', category: 'sauces', name: 'Raita (yogurt sauce)', emoji: '🥒', cat: 'high', groups: ['lactose'], lowT: null, modT: null, popTrigger: 60, group: 'dish' },
  { id: 'plain_dosa', category: 'prepared_dish', name: 'Plain dosa', emoji: '🥞', cat: 'mod', groups: ['gos'], lowT: null, modT: null, popTrigger: 40, group: 'dish' },
  { id: 'kebab', category: 'prepared_dish', name: 'Döner kebab', emoji: '🥙', cat: 'high', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 70, group: 'dish' },
  // European (German / French / Spanish / Greek / British)
  { id: 'schnitzel', category: 'prepared_dish', name: 'Schnitzel', emoji: '🍖', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 55, group: 'dish' },
  { id: 'croissant', category: 'bread', name: 'Croissant', emoji: '🥐', cat: 'high', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 60, group: 'dish' },
  { id: 'baguette', category: 'bread', name: 'Baguette', emoji: '🥖', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 65, group: 'dish' },
  { id: 'quiche', category: 'prepared_dish', name: 'Quiche Lorraine', emoji: '🥧', cat: 'high', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 60, group: 'dish' },
  { id: 'paella', category: 'prepared_dish', name: 'Paella', emoji: '🥘', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 55, group: 'dish' },
  { id: 'tortilla_espanola', category: 'prepared_dish', name: 'Spanish tortilla', emoji: '🍳', cat: 'mod', groups: ['fructans'], lowT: null, modT: null, popTrigger: 40, group: 'dish' },
  { id: 'fish_and_chips', category: 'prepared_dish', name: 'Fish and chips', emoji: '🐟', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 55, group: 'dish' },
  { id: 'goulash', category: 'prepared_dish', name: 'Goulash', emoji: '🍲', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 60, group: 'dish' },
  { id: 'moussaka', category: 'prepared_dish', name: 'Moussaka', emoji: '🍆', cat: 'high', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 60, group: 'dish' },
  { id: 'pretzel', category: 'snacks', pieceG: 80, name: 'Pretzel', emoji: '🥨', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 55, group: 'dish' },
  { id: 'greek_salad', category: 'vegetables', name: 'Greek salad', emoji: '🥗', cat: 'mod', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 30, group: 'dish' },
  { id: 'crepe', category: 'prepared_dish', name: 'Crêpe', emoji: '🥞', cat: 'high', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 50, group: 'dish' },
  // US / American (additional)
  { id: 'fried_chicken', category: 'prepared_dish', name: 'Fried chicken', emoji: '🍗', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 55, group: 'dish' },
  { id: 'burrito', category: 'prepared_dish', name: 'Burrito', emoji: '🌯', cat: 'high', groups: ['fructans', 'gos'], lowT: null, modT: null, popTrigger: 75, group: 'dish' },
  { id: 'taco', category: 'prepared_dish', name: 'Beef taco', emoji: '🌮', cat: 'mod', groups: ['fructans'], lowT: null, modT: null, popTrigger: 45, group: 'dish' },
  { id: 'taco_chicken', category: 'prepared_dish', name: 'Chicken taco', emoji: '🌮', cat: 'mod', groups: ['fructans'], lowT: null, modT: null, popTrigger: 42, group: 'dish' },
  { id: 'taco_fish', category: 'prepared_dish', name: 'Fish taco', emoji: '🌮', cat: 'mod', groups: ['fructans'], lowT: null, modT: null, popTrigger: 40, group: 'dish' },
  { id: 'taco_pork', category: 'prepared_dish', name: 'Pork taco (al pastor)', emoji: '🌮', cat: 'mod', groups: ['fructans'], lowT: null, modT: null, popTrigger: 42, group: 'dish' },
  { id: 'burger', category: 'prepared_dish', name: 'Burger (plain)', emoji: '🍔', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 70, group: 'dish', base: true },
  { id: 'burger_vegan', category: 'prepared_dish', name: 'Vegan burger (plain)', emoji: '🍔', cat: 'high', groups: ['fructans', 'gos'], lowT: null, modT: null, popTrigger: 55, group: 'dish', base: true, alias: 'plant based veggie burger vegetarian' },
  { id: 'gyros', category: 'prepared_dish', name: 'Gyros', emoji: '🥙', cat: 'high', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 60, group: 'dish', alias: 'greek pita doner' },
  { id: 'souvlaki', category: 'prepared_dish', name: 'Souvlaki', emoji: '🍢', cat: 'high', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 55, group: 'dish', alias: 'greek skewer pita' },
  { id: 'falafel_wrap', category: 'prepared_dish', name: 'Falafel wrap', emoji: '🧆', cat: 'high', groups: ['gos', 'fructans'], lowT: null, modT: null, popTrigger: 55, group: 'dish', alias: 'chickpea pita wrap street' },
  { id: 'churros', category: 'prepared_dish', name: 'Churros', emoji: '🥖', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 50, group: 'dish', alias: 'fried dough spanish' },
  { id: 'langos', category: 'prepared_dish', name: 'Langos', emoji: '🫓', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 50, group: 'dish', alias: 'hungarian fried flatbread langosh' },
  { id: 'pierogi', category: 'prepared_dish', name: 'Pierogi', emoji: '🥟', cat: 'high', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 50, group: 'dish', alias: 'polish dumplings perogi' },
  { id: 'arepa_de_queso', category: 'prepared_dish', name: 'Arepa de queso', emoji: '🫓', cat: 'mod', groups: ['fructans'], lowT: null, modT: null, popTrigger: 35, group: 'dish' },
  { id: 'empanada', category: 'prepared_dish', name: 'Empanada', emoji: '🥟', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 60, group: 'dish' },
  { id: 'nachos', category: 'prepared_dish', name: 'Nachos', emoji: '🧀', cat: 'high', groups: ['fructans', 'gos', 'lactose'], lowT: null, modT: null, popTrigger: 60, group: 'dish' },
  { id: 'donut', category: 'desserts', name: 'Donut', emoji: '🍩', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 55, group: 'dish' },
  { id: 'apple_pie', category: 'desserts', name: 'Apple pie', emoji: '🥧', cat: 'high', groups: ['fructose', 'sorbitol', 'fructans'], lowT: null, modT: null, popTrigger: 65, group: 'dish' },
  { id: 'cheesecake', category: 'desserts', name: 'Cheesecake', emoji: '🍰', cat: 'high', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 60, group: 'dish' },
  { id: 'chili_con_carne', category: 'prepared_dish', name: 'Chili con carne', emoji: '🌶️', cat: 'high', groups: ['gos', 'fructans'], lowT: null, modT: null, popTrigger: 70, group: 'dish' },
  { id: 'scrambled_eggs', category: 'eggs', name: 'Scrambled eggs', emoji: '🍳', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 10, group: 'dish' },
  { id: 'coleslaw', category: 'vegetables', name: 'Coleslaw', emoji: '🥗', cat: 'mod', groups: ['fructans'], lowT: null, modT: null, popTrigger: 35, group: 'dish' },
  // Chinese (additional)
  { id: 'general_tso_chicken', category: 'prepared_dish', name: "General Tso's chicken", emoji: '🍗', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 72, group: 'dish' },
  { id: 'lo_mein', category: 'prepared_dish', name: 'Lo mein', emoji: '🍜', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 75, group: 'dish' },
  { id: 'peking_duck', category: 'prepared_dish', name: 'Peking duck', emoji: '🦆', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 55, group: 'dish' },
  { id: 'hot_sour_soup', category: 'soups', name: 'Hot and sour soup', emoji: '🍲', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 60, group: 'dish' },
  { id: 'char_siu', category: 'prepared_dish', name: 'Char siu pork', emoji: '🍖', cat: 'high', groups: ['fructans', 'fructose'], lowT: null, modT: null, popTrigger: 55, group: 'dish' },
  { id: 'egg_drop_soup', category: 'soups', name: 'Egg drop soup', emoji: '🥣', cat: 'mod', groups: ['fructans'], lowT: null, modT: null, popTrigger: 35, group: 'dish' },
  // International favorites popular across the EU / US (Japanese, Thai, Vietnamese, Korean, Mexican, Middle Eastern)
  { id: 'salmon_nigiri', category: 'prepared_dish', name: 'Sushi — plain', emoji: '🍣', cat: 'low', groups: [], lowT: null, modT: null, popTrigger: 15, group: 'dish', alias: 'sushi nigiri maki sashimi' },
  { id: 'california_roll', category: 'prepared_dish', name: 'Sushi — with avocado', emoji: '🍣', cat: 'mod', groups: ['sorbitol'], lowT: null, modT: null, popTrigger: 30, group: 'dish', alias: 'sushi california roll avocado maki' },
  { id: 'ramen', category: 'soups', name: 'Ramen', emoji: '🍜', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 70, group: 'dish' },
  { id: 'teriyaki_chicken', category: 'prepared_dish', name: 'Chicken teriyaki', emoji: '🍗', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 60, group: 'dish' },
  { id: 'miso_soup', category: 'soups', name: 'Miso soup', emoji: '🥣', cat: 'mod', groups: ['fructans'], lowT: null, modT: null, popTrigger: 35, group: 'dish' },
  { id: 'edamame', category: 'legumes', name: 'Edamame', emoji: '🫛', cat: 'mod', groups: ['gos'], lowT: null, modT: null, popTrigger: 40, group: 'dish' },
  { id: 'tempura', category: 'prepared_dish', name: 'Tempura', emoji: '🍤', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 60, group: 'dish' },
  { id: 'pad_thai', category: 'prepared_dish', name: 'Pad thai', emoji: '🍜', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 65, group: 'dish' },
  { id: 'green_curry', category: 'prepared_dish', name: 'Thai green curry', emoji: '🍛', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 65, group: 'dish' },
  { id: 'tom_yum', category: 'soups', name: 'Tom yum soup', emoji: '🍲', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 60, group: 'dish' },
  { id: 'pho', category: 'soups', name: 'Pho', emoji: '🍜', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 60, group: 'dish' },
  { id: 'bibimbap', category: 'prepared_dish', name: 'Bibimbap', emoji: '🍚', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 60, group: 'dish' },
  { id: 'bulgogi', category: 'prepared_dish', name: 'Bulgogi', emoji: '🥩', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 60, group: 'dish' },
  { id: 'guacamole', category: 'spreads', name: 'Guacamole', emoji: '🥑', cat: 'mod', groups: ['sorbitol', 'fructans'], lowT: null, modT: null, popTrigger: 40, group: 'dish' },
  { id: 'quesadilla', category: 'prepared_dish', name: 'Quesadilla', emoji: '🧀', cat: 'high', groups: ['fructans', 'lactose'], lowT: null, modT: null, popTrigger: 65, group: 'dish' },
  { id: 'falafel', category: 'prepared_dish', name: 'Falafel', emoji: '🧆', cat: 'high', groups: ['gos', 'fructans'], lowT: null, modT: null, popTrigger: 75, group: 'dish' },
  { id: 'shakshuka', category: 'prepared_dish', name: 'Shakshuka', emoji: '🍳', cat: 'high', groups: ['fructans'], lowT: null, modT: null, popTrigger: 55, group: 'dish' },
  { id: 'poke_bowl', category: 'prepared_dish', name: 'Poke bowl', emoji: '🍲', cat: 'mod', groups: ['gos'], lowT: null, modT: null, popTrigger: 40, group: 'dish' },
];

const GROUP_INFO = {
  fructans: { name: 'Fructans', desc: 'Long chains of fructose found in wheat, onion, garlic.' },
  gos: { name: 'GOS', desc: 'Found in legumes, beans, cashews. Cause gas in sensitive guts.' },
  lactose: { name: 'Lactose', desc: 'Sugar in dairy. Many adults lack the enzyme to digest it.' },
  fructose: { name: 'Excess Fructose', desc: 'In honey, apples, mango. Hard to absorb.' },
  mannitol: { name: 'Mannitol', desc: 'Sugar alcohol in mushrooms, cauliflower.' },
  sorbitol: { name: 'Sorbitol', desc: 'Sugar alcohol in apples, pears.' },
  histamine: { name: 'Histamine', desc: 'Aged, fermented, or smoked foods. Builds up if your DAO enzyme is low.' },
};

// Cross-intolerance reference: maps food id -> histamine level.
// 'high' = avoid for histamine-sensitive users. 'mod' = caution. 'liberator' = doesn't contain histamine but triggers release. Absent = considered safe.
const HISTAMINE_FOODS = {
  // High histamine (aged, fermented, cured, smoked, or naturally rich)
  tomato: 'high', cherry_tomato: 'high', spinach: 'high', eggplant: 'high', avocado: 'high',
  sauerkraut: 'high', kimchi: 'high', olives: 'high', pickles: 'high',
  parmesan: 'high', pecorino: 'high', cheddar: 'high', feta: 'high', mozzarella: 'high',
  brie: 'high', camembert: 'high', gruyere: 'high', gouda: 'high', provolone: 'high', blue_cheese: 'high',
  yogurt: 'high', greek_yogurt: 'high', skyr: 'high', kefir: 'high',
  bratwurst: 'high', currywurst: 'high', prosciutto: 'high', salami: 'high', bacon: 'high', tuna: 'high', oily_fish: 'high',
  wine_red: 'high', wine_white: 'high', beer: 'high',
  pasta_sauce: 'high', pasta_sauce_plain: 'high', soy_sauce: 'high',
  // Histamine liberators (release the body's own histamine even without containing it)
  strawberry: 'liberator', banana: 'liberator', pineapple: 'liberator', kiwi: 'liberator',
  chocolate_dark: 'liberator', dark_chocolate: 'liberator', peanuts: 'liberator',
  shrimp: 'liberator', shellfish: 'liberator', grapefruit: 'liberator', papaya: 'liberator',
  // Moderate histamine
  raspberry: 'mod', salmon: 'mod', pork: 'mod', swiss_cheese: 'mod', ham: 'mod',
  raisins: 'mod', dried_apricot: 'mod', prunes: 'mod', dried_fig: 'mod', dates: 'mod',
  // Prepared dishes that are basically histamine bombs
  pizza: 'high', pinsa: 'high', lasagna: 'high', spaghetti_bolognese: 'high',
  spaghetti_carbonara: 'high', tiramisu: 'high', caprese_salad: 'high',
  cheeseburger: 'high', mac_cheese: 'high', bagel_cream_cheese: 'high', cobb_salad: 'high',
  gyros: 'high', souvlaki: 'high', burger: 'mod', burger_vegan: 'mod',
  kung_pao_chicken: 'high', sweet_sour_pork: 'high', mapo_tofu: 'high',
  butter_chicken: 'high', chicken_tikka_masala: 'high', palak_paneer: 'high',
};

// Returns array of cross-intolerance warnings for a food, given the user's profile.
// Each warning: { kind: 'histamine', level: 'high'|'mod'|'liberator', label, color }
function crossIntoleranceWarnings(food, profile) {
  const known = (profile && profile.known) || [];
  const warnings = [];
  if (known.indexOf('histamine') >= 0) {
    const h = HISTAMINE_FOODS[food.id];
    if (h === 'high') warnings.push({ kind: 'histamine', level: 'high', label: 'High histamine', color: '#a03030' });
    else if (h === 'mod') warnings.push({ kind: 'histamine', level: 'mod', label: 'Moderate histamine', color: '#a86518' });
    else if (h === 'liberator') warnings.push({ kind: 'histamine', level: 'liberator', label: 'Histamine liberator', color: '#a86518' });
  }
  return warnings;
}

// Returns true if a meal contains any cross-intolerance issue even when FODMAP-safe.
function mealCrossWarnings(items, profile) {
  const known = (profile && profile.known) || [];
  if (known.indexOf('histamine') < 0) return null;
  const highHist = [];
  const liberators = [];
  for (const it of items) {
    const food = FOODS.find(f => f.id === it.foodId);
    if (!food) continue;
    const h = HISTAMINE_FOODS[food.id];
    if (h === 'high') highHist.push(food.name);
    else if (h === 'liberator') liberators.push(food.name);
  }
  if (highHist.length === 0 && liberators.length === 0) return null;
  return { highHist, liberators };
}


// 50 elimination-phase-safe recipes. Every ingredient maps to a low-FODMAP food in FOODS.
// Use garlic-infused olive oil instead of garlic; spring onion greens (not bulbs) for onion flavor.
const RECIPES = [
  // BREAKFAST (12)
  { id: 'r1', title: 'Blueberry oat porridge', meal: 'breakfast', emoji: '🥣', minutes: 10, ingredientIds: ['oats', 'almond_milk', 'blueberry', 'maple'], steps: 'Bring 50g rolled oats and 200ml almond milk to a gentle simmer over medium heat, stirring often so it doesn\'t catch, for about 5 minutes until thick and creamy. Take it off the heat and let it rest for a minute to thicken. Spoon into a bowl and top with a small handful of blueberries and a drizzle of maple syrup. Keep the oats to about 50g dry — a larger portion pushes the fructans into the moderate range.' },
  { id: 'r2', title: 'Scrambled eggs on rice toast', meal: 'breakfast', emoji: '🍳', minutes: 8, ingredientIds: ['egg', 'gluten_free_bread', 'butter', 'tomato'], steps: 'Whisk 2 eggs with a pinch of salt. Melt a knob of butter in a non-stick pan over low-medium heat, pour in the eggs and stir gently with a spatula until just set but still soft and creamy. Meanwhile toast two slices of gluten-free bread and butter them lightly. Pile the scrambled eggs on top and serve with a few slices of fresh tomato.' },
  { id: 'r3', title: 'Lactose-free yogurt bowl', meal: 'breakfast', emoji: '🥣', minutes: 3, ingredientIds: ['lactose_free_yogurt', 'strawberry', 'chia_seeds', 'walnuts'], steps: 'Spoon a generous serving of lactose-free yogurt into a bowl. Hull and halve a small handful of strawberries and scatter them over the top. Sprinkle over 1 tablespoon of chia seeds and a few chopped walnuts for crunch. Let it sit for a couple of minutes so the chia softens slightly before eating.' },
  { id: 'r4', title: 'Firm banana smoothie', meal: 'breakfast', emoji: '🥤', minutes: 4, ingredientIds: ['banana_green', 'almond_milk', 'chia_seeds', 'maple'], steps: 'Peel one firm (unripe) banana and break it into chunks. Blend with 200ml almond milk, 1 tablespoon of chia seeds and a drizzle of maple syrup until completely smooth. Add a couple of ice cubes and blend again for a colder, thicker texture. Use a firm banana rather than a very ripe one — it keeps the smoothie low-FODMAP.' },
  { id: 'r5', title: 'Buckwheat pancakes', meal: 'breakfast', emoji: '🥞', minutes: 15, ingredientIds: ['buckwheat', 'egg', 'almond_milk', 'maple', 'blueberry'], steps: 'Whisk 100g buckwheat flour with 1 egg and enough almond milk to make a smooth, pourable batter. Heat a lightly oiled non-stick pan over medium heat and pour in small rounds. Cook until bubbles form on the surface, then flip and cook the other side until golden. Stack the pancakes and top with maple syrup and a handful of blueberries.' },
  { id: 'r6', title: 'Spinach & feta omelette', meal: 'breakfast', emoji: '🍳', minutes: 10, ingredientIds: ['egg', 'spinach', 'feta', 'olive_oil'], steps: 'Sauté up to 75g baby spinach in a little olive oil until just wilted, then set aside. Beat 2 eggs with a pinch of salt and pour into the same pan over medium heat. As the base sets, scatter the spinach and crumbled feta over one half. Fold the omelette over the filling and slide it onto a plate.' },
  { id: 'r7', title: 'Rice flakes with kiwi', meal: 'breakfast', emoji: '🥣', minutes: 5, ingredientIds: ['oats', 'almond_milk', 'kiwi', 'pumpkin_seeds'], steps: 'Warm 50g oats in 200ml almond milk over low heat for a few minutes until soft and creamy. Pour into a bowl and let it cool slightly. Peel and slice a kiwi and lay the slices over the top. Finish with a sprinkle of pumpkin seeds for crunch.' },
  { id: 'r8', title: 'Chia pudding', meal: 'breakfast', emoji: '🍮', minutes: 5, ingredientIds: ['chia_seeds', 'almond_milk', 'maple', 'raspberry'], steps: 'Stir 3 tablespoons of chia seeds into 200ml almond milk with a drizzle of maple syrup until evenly mixed. Cover and refrigerate overnight, or at least 4 hours, so the seeds swell into a soft pudding. Give it a good stir before serving to break up any clumps. Top with a small handful of raspberries.' },
  { id: 'r9', title: 'Avocado on toast', meal: 'breakfast', emoji: '🥑', minutes: 5, ingredientIds: ['gluten_free_bread', 'avocado', 'lemon', 'olive_oil'], steps: 'Mash about 30g of avocado with a squeeze of lemon juice, a pinch of salt and a little olive oil. Toast a slice of gluten-free bread until crisp. Spread the avocado evenly over the top and finish with a final drizzle of olive oil. Keep to around 30g of avocado to stay low-FODMAP.' },
  { id: 'r10', title: 'Quinoa breakfast bowl', meal: 'breakfast', emoji: '🥣', minutes: 15, ingredientIds: ['quinoa', 'almond_milk', 'blueberry', 'walnuts', 'maple'], steps: 'Rinse 50g quinoa well, then simmer in 200ml almond milk for about 12–15 minutes until tender and most of the liquid is absorbed. Spoon into a bowl and let it cool slightly. Top with a handful of blueberries and a few chopped walnuts. Finish with a drizzle of maple syrup.' },
  { id: 'r11', title: 'Soft-boiled eggs & rice', meal: 'breakfast', emoji: '🥚', minutes: 8, ingredientIds: ['egg', 'rice', 'soy_sauce'], steps: 'Lower 2 eggs into gently boiling water and cook for 6 minutes for a soft, runny yolk, then cool them briefly under cold water and peel carefully. Warm a bowl of cooked rice. Halve the eggs over the rice and finish with a splash of soy sauce. Serve while everything is still warm.' },
  { id: 'r12', title: 'Yogurt & pineapple', meal: 'breakfast', emoji: '🍍', minutes: 3, ingredientIds: ['lactose_free_yogurt', 'pineapple', 'chia_seeds'], steps: 'Spoon lactose-free yogurt into a glass or bowl. Cut fresh pineapple into small chunks and layer them over the yogurt. Sprinkle a little chia between the layers and add a second layer if you like. Eat straight away while the pineapple is still juicy.' },

  // LUNCH (14)
  { id: 'r13', title: 'Chicken & rice bowl', meal: 'lunch', emoji: '🍚', minutes: 20, ingredientIds: ['chicken', 'rice', 'carrot', 'cucumber', 'soy_sauce', 'olive_oil'], steps: 'Cook the rice and keep it warm. Slice a chicken breast and pan-fry it in olive oil over medium-high heat until golden and cooked through, about 6–8 minutes. Grate the carrot and thinly slice the cucumber. Pile the chicken and vegetables over the rice and finish with a splash of soy sauce.' },
  { id: 'r14', title: 'Tuna & potato salad', meal: 'lunch', emoji: '🥗', minutes: 25, ingredientIds: ['tuna', 'potato', 'mayo', 'cucumber', 'mustard'], steps: 'Boil cubed potatoes until just tender, about 12–15 minutes, then drain and let them cool. Drain a tin of tuna and flake it into a bowl. Add the potatoes, a spoon of mayonnaise, a little mustard and some diced cucumber, and fold everything together gently. Season to taste and serve cool.' },
  { id: 'r15', title: 'Quinoa salad with feta', meal: 'lunch', emoji: '🥗', minutes: 20, ingredientIds: ['quinoa', 'feta', 'cucumber', 'cherry_tomato', 'olive_oil', 'lemon'], steps: 'Cook the quinoa, then spread it out on a plate to cool. Tip it into a bowl with crumbled feta, diced cucumber and halved cherry tomatoes (up to 75g). Dress with olive oil and a good squeeze of lemon, and toss to combine. Season with salt and pepper before serving.' },
  { id: 'r16', title: 'Shrimp lettuce wraps', meal: 'lunch', emoji: '🥬', minutes: 15, ingredientIds: ['shrimp', 'lettuce', 'carrot', 'soy_sauce', 'ginger'], steps: 'Grate a little fresh ginger and sauté the shrimp with it in a hot pan with a splash of soy until pink and just cooked, 2–3 minutes. Separate whole lettuce leaves to use as cups. Spoon the shrimp into the leaves and top with shredded carrot. Serve straight away while still warm.' },
  { id: 'r17', title: 'Turkey & rice noodle bowl', meal: 'lunch', emoji: '🍜', minutes: 15, ingredientIds: ['turkey', 'rice_noodle', 'carrot', 'cucumber', 'soy_sauce', 'garlic_oil'], steps: 'Cook the rice noodles according to the packet, then drain and rinse. Pan-fry the turkey in garlic-infused oil over medium-high heat until cooked through. Julienne the carrot and cucumber into thin strips. Toss the noodles with the turkey and vegetables and finish with soy sauce.' },
  { id: 'r18', title: 'Tomato & mozzarella plate', meal: 'lunch', emoji: '🍅', minutes: 5, ingredientIds: ['tomato', 'mozzarella', 'olive_oil', 'pesto'], steps: 'Slice fresh tomato (up to 65g per serving) and arrange on a plate with slices of mozzarella. Drizzle generously with olive oil and add a spoonful of basil pesto. Season with a little salt and pepper. Serve at room temperature for the best flavour.' },
  { id: 'r19', title: 'Salmon & quinoa', meal: 'lunch', emoji: '🐟', minutes: 20, ingredientIds: ['salmon', 'quinoa', 'spinach', 'lemon', 'olive_oil'], steps: 'Heat the oven to 200°C. Place the salmon on a lined tray, drizzle with olive oil and a squeeze of lemon, and bake for about 12 minutes until it flakes easily. Meanwhile cook the quinoa and wilt the spinach in a hot pan. Serve the salmon over the quinoa with the spinach alongside.' },
  { id: 'r20', title: 'Egg & potato salad', meal: 'lunch', emoji: '🥚', minutes: 20, ingredientIds: ['egg', 'potato', 'mayo', 'mustard', 'lettuce'], steps: 'Boil the eggs and cubed potatoes until both are just done, then cool and peel the eggs. Roughly chop the eggs and combine with the potatoes, a spoon of mayonnaise and a little mustard. Fold gently so the potatoes keep their shape. Serve over a bed of lettuce leaves.' },
  { id: 'r21', title: 'Chicken & cucumber wrap', meal: 'lunch', emoji: '🌯', minutes: 10, ingredientIds: ['chicken', 'gluten_free_bread', 'cucumber', 'lettuce', 'mayo'], steps: 'Spread a gluten-free wrap with a thin layer of mayonnaise. Lay a few lettuce leaves down the middle, then add sliced cucumber and shredded cooked chicken. Season with a little salt and pepper. Roll it up tightly, tuck in the ends, and slice in half to serve.' },
  { id: 'r22', title: 'Rice & seared tuna', meal: 'lunch', emoji: '🍣', minutes: 15, ingredientIds: ['tuna', 'rice', 'cucumber', 'soy_sauce', 'olive_oil'], steps: 'Cook the rice and keep it warm. Pat a tuna steak dry and sear it in a little olive oil over high heat for about 1 minute per side so it stays pink in the middle. Slice the tuna and lay it over the rice with ribbons of cucumber. Finish with a splash of soy sauce.' },
  { id: 'r23', title: 'Pumpkin & feta salad', meal: 'lunch', emoji: '🎃', minutes: 25, ingredientIds: ['pumpkin', 'feta', 'lettuce', 'sunflower_seeds', 'olive_oil'], steps: 'Heat the oven to 200°C. Toss cubed pumpkin with olive oil and roast for about 20 minutes until soft and lightly caramelised, then let it cool a little. Tip into a bowl with lettuce, crumbled feta and sunflower seeds. Drizzle with olive oil and toss gently to combine.' },
  { id: 'r24', title: 'Pork & rice bowl', meal: 'lunch', emoji: '🥩', minutes: 18, ingredientIds: ['pork', 'rice', 'carrot', 'soy_sauce', 'ginger'], steps: 'Cook the rice and keep it warm. Grate a little fresh ginger and stir-fry thinly sliced pork with it in a hot pan until cooked through. Steam or lightly boil the carrots until just tender. Serve the pork and carrots over the rice with a splash of soy sauce.' },
  { id: 'r25', title: 'Caprese with olives', meal: 'lunch', emoji: '🫒', minutes: 5, ingredientIds: ['mozzarella', 'tomato', 'olives', 'olive_oil'], steps: 'Slice fresh mozzarella and tomato and arrange them alternately on a plate. Scatter a few olives over the top. Drizzle generously with olive oil and season with salt to taste. Serve at room temperature — chilling dulls the flavour.' },
  { id: 'r26', title: 'Beef & rice noodle stir-fry', meal: 'lunch', emoji: '🍜', minutes: 15, ingredientIds: ['beef', 'rice_noodle', 'green_beans', 'soy_sauce', 'ginger', 'garlic_oil'], steps: 'Cook the rice noodles, then drain and set aside. Stir-fry thinly sliced beef and trimmed green beans in garlic-infused oil over high heat with a little grated ginger until the beef is browned and the beans are tender-crisp. Add the noodles and a good splash of soy sauce. Toss everything together over the heat for a minute and serve.' },

  // DINNER (16)
  { id: 'r27', title: 'Baked salmon & potatoes', meal: 'dinner', emoji: '🐟', minutes: 30, ingredientIds: ['salmon', 'potato', 'lemon', 'olive_oil', 'kale'], steps: 'Heat the oven to 200°C. Toss cubed potatoes with olive oil, salt and pepper, spread on a tray, and roast for 10 minutes to get them going. Add the salmon fillet skin-side down, season, and roast for another 12–15 minutes until it flakes easily. Meanwhile wilt the kale in a hot pan with a splash of oil for 2–3 minutes. Plate everything with a good squeeze of lemon over the salmon.' },
  { id: 'r28', title: 'Chicken & rice with carrots', meal: 'dinner', emoji: '🍗', minutes: 30, ingredientIds: ['chicken', 'rice', 'carrot', 'olive_oil', 'garlic_oil'], steps: 'Heat the oven to 200°C. Rub chicken thighs with a little garlic-infused oil, salt and pepper and place in a roasting tin with the carrots. Roast for about 25 minutes until the chicken is golden and cooked through. Meanwhile cook the rice. Serve the chicken and carrots over the rice, spooning over any pan juices.' },
  { id: 'r29', title: 'Pasta with pesto (GF)', meal: 'dinner', emoji: '🍝', minutes: 15, ingredientIds: ['gluten_free_pasta', 'pesto', 'cherry_tomato', 'parmesan', 'olive_oil'], steps: 'Cook the gluten-free pasta in salted water until al dente, then drain, keeping a little of the cooking water. Return the pasta to the pan and toss with basil pesto, loosening with a splash of the reserved water if needed. Halve the cherry tomatoes (up to 75g) and fold them through. Serve with grated parmesan on top.' },
  { id: 'r30', title: 'Shrimp & zucchini stir-fry', meal: 'dinner', emoji: '🦐', minutes: 15, ingredientIds: ['shrimp', 'zucchini', 'rice', 'soy_sauce', 'garlic_oil', 'ginger'], steps: 'Cook the rice and keep it warm. Grate a little ginger and sauté the shrimp with it in garlic-infused oil over high heat until pink, 2–3 minutes, then remove. Add diced zucchini (about 65g per portion) to the pan and stir-fry until just tender. Return the shrimp, add a splash of soy sauce, and serve over the rice.' },
  { id: 'r31', title: 'Beef & potato stew', meal: 'dinner', emoji: '🍲', minutes: 60, ingredientIds: ['beef', 'potato', 'carrot', 'garlic_oil', 'olive_oil'], steps: 'Brown the beef chunks in a little olive oil in a heavy pot over medium-high heat, working in batches so they colour rather than steam. Add cubed potatoes and carrots, a spoon of garlic-infused oil, and enough water to just cover. Bring to a simmer, cover, and cook gently for about 45 minutes until the beef is tender and the sauce has thickened. Season to taste before serving.' },
  { id: 'r32', title: 'Roast pork & kale', meal: 'dinner', emoji: '🥩', minutes: 35, ingredientIds: ['pork', 'kale', 'potato', 'mustard', 'olive_oil'], steps: 'Heat the oven to 200°C. Rub the pork with mustard, salt and pepper and place in a roasting tin alongside cubed potatoes tossed in olive oil. Roast for about 25 minutes until the pork is cooked through and the potatoes are golden, then rest the meat for a few minutes. Meanwhile wilt the kale in a hot pan with a little olive oil. Slice the pork and serve with the potatoes and kale.' },
  { id: 'r33', title: 'White fish with rice & beans', meal: 'dinner', emoji: '🐟', minutes: 20, ingredientIds: ['white_fish', 'rice', 'green_beans', 'lemon', 'olive_oil'], steps: 'Cook the rice and keep it warm. Pan-fry a white fish fillet in olive oil over medium heat for 3–4 minutes per side with a squeeze of lemon, until it flakes easily. Meanwhile steam the green beans until just tender. Serve the fish over the rice with the beans alongside and any pan juices spooned over.' },
  { id: 'r34', title: 'Turkey meatballs & rice', meal: 'dinner', emoji: '🍝', minutes: 25, ingredientIds: ['turkey', 'rice', 'tomato', 'parmesan', 'olive_oil', 'garlic_oil'], steps: 'Season turkey mince with salt and pepper and roll into small meatballs. Pan-fry them in a little olive oil, turning, until browned all over and cooked through. Add fresh diced tomato and a spoon of garlic-infused oil and simmer for 10 minutes into a light sauce. Serve over rice with grated parmesan on top.' },
  { id: 'r35', title: 'Tofu & rice noodles', meal: 'dinner', emoji: '🍱', minutes: 15, ingredientIds: ['tofu', 'rice_noodle', 'carrot', 'soy_sauce', 'ginger', 'garlic_oil'], steps: 'Press and cube firm tofu (up to 170g) and pat it dry. Pan-fry in a little oil until crisp and golden on all sides. Cook the rice noodles, then toss them with the tofu, julienned carrot, a splash of soy sauce and a little grated ginger. Serve warm.' },
  { id: 'r36', title: 'Lemon herb chicken & quinoa', meal: 'dinner', emoji: '🍗', minutes: 30, ingredientIds: ['chicken', 'quinoa', 'lemon', 'olive_oil', 'spinach'], steps: 'Marinate a chicken breast in lemon juice, olive oil, salt and pepper for a few minutes. Pan-fry over medium heat until golden and cooked through, about 6–8 minutes, then let it rest and slice. Meanwhile cook the quinoa and wilt the spinach in a hot pan. Serve the chicken over the quinoa with the spinach alongside.' },
  { id: 'r37', title: 'Eggplant & tomato bake', meal: 'dinner', emoji: '🍆', minutes: 35, ingredientIds: ['eggplant', 'tomato', 'mozzarella', 'olive_oil', 'pesto'], steps: 'Heat the oven to 200°C. Slice the eggplant (about 75g per portion) and layer it in a dish with sliced tomato and mozzarella. Drizzle with olive oil and season. Bake for about 25 minutes until soft and bubbling. Finish with a spoon of pesto before serving.' },
  { id: 'r38', title: 'Buckwheat risotto', meal: 'dinner', emoji: '🍚', minutes: 30, ingredientIds: ['buckwheat', 'carrot', 'parmesan', 'olive_oil', 'spinach'], steps: 'Toast the buckwheat in a little olive oil in a pan for a minute. Add hot water a ladle at a time, stirring, until the grains are tender and creamy, about 20 minutes. Stir in diced carrot and spinach towards the end so they cook through. Finish with grated parmesan and season to taste.' },
  { id: 'r39', title: 'Bratwurst with sauerkraut alt', meal: 'dinner', emoji: '🌭', minutes: 15, ingredientIds: ['bratwurst', 'potato', 'mustard', 'cabbage_white'], steps: 'Pan-fry the bratwurst (up to 100g) over medium heat, turning, until browned and cooked through. Boil some potatoes until tender. Lightly sauté shredded white cabbage (up to 75g) in a little oil as a low-FODMAP alternative to sauerkraut. Serve the sausage with the potatoes, cabbage and a spoon of mustard.' },
  { id: 'r40', title: 'Salmon & zucchini noodles', meal: 'dinner', emoji: '🐟', minutes: 20, ingredientIds: ['salmon', 'zucchini', 'lemon', 'olive_oil', 'pesto'], steps: 'Spiralize the zucchini (up to 65g per portion) into noodles. Sauté them briefly in a little olive oil so they stay firm, 1–2 minutes. Meanwhile bake or pan-fry the salmon until it flakes. Top the zucchini noodles with the salmon, a squeeze of lemon and a spoon of pesto.' },
  { id: 'r41', title: 'Spaghetti aglio e olio (GF)', meal: 'dinner', emoji: '🍝', minutes: 15, ingredientIds: ['gluten_free_pasta', 'garlic_oil', 'olive_oil', 'parmesan'], steps: 'Cook the gluten-free spaghetti in well-salted water until al dente, then drain, saving a little pasta water. Warm plenty of garlic-infused olive oil in a pan over low heat so it doesn\'t burn. Toss the drained pasta in the oil with a splash of the reserved water to bring it together. Finish with grated parmesan and a good crack of black pepper.' },
  { id: 'r42', title: 'Roast chicken & pumpkin', meal: 'dinner', emoji: '🎃', minutes: 45, ingredientIds: ['chicken', 'pumpkin', 'olive_oil', 'kale', 'garlic_oil'], steps: 'Heat the oven to 200°C. Cut the pumpkin into cubes and toss with garlic-infused oil, salt and pepper. Place the chicken and pumpkin in a roasting tin and roast for about 35 minutes until the chicken is golden and cooked through and the pumpkin is soft. Meanwhile sauté the kale in a hot pan until wilted. Serve the chicken with the pumpkin and kale.' },

  // SNACKS (8)
  { id: 'r43', title: 'Carrot sticks & garlic-oil hummus alt', meal: 'snack', emoji: '🥕', minutes: 5, ingredientIds: ['carrot', 'tofu', 'garlic_oil', 'lemon'], steps: 'Blend silken tofu with a spoon of garlic-infused oil, a squeeze of lemon and a pinch of salt until smooth and creamy — a low-FODMAP alternative to hummus. Taste and adjust the seasoning. Cut the carrots into sticks. Serve the dip with the carrot sticks for dunking.' },
  { id: 'r44', title: 'Rice cakes with peanut butter', meal: 'snack', emoji: '🥜', minutes: 2, ingredientIds: ['peanuts', 'banana_green'], steps: 'Spread peanut butter evenly over a couple of rice cakes. Peel a firm (green) banana and slice it thinly. Lay the slices over the peanut butter. Eat straight away so the rice cakes stay crisp.' },
  { id: 'r45', title: 'Cheese & olives', meal: 'snack', emoji: '🧀', minutes: 2, ingredientIds: ['cheddar', 'olives', 'walnuts'], steps: 'Cut the cheddar into small cubes. Arrange on a plate with a few olives and a small handful of walnuts. That\'s it — a quick, low-FODMAP snack plate. Keep portions modest, especially the walnuts.' },
  { id: 'r46', title: 'Berry & yogurt cup', meal: 'snack', emoji: '🫐', minutes: 2, ingredientIds: ['lactose_free_yogurt', 'blueberry', 'maple'], steps: 'Spoon lactose-free yogurt into a cup or small bowl. Scatter over a handful of blueberries. Add a drizzle of maple syrup for a little sweetness. Eat straight away.' },
  { id: 'r47', title: 'Cucumber & feta bites', meal: 'snack', emoji: '🥒', minutes: 5, ingredientIds: ['cucumber', 'feta', 'olive_oil'], steps: 'Slice the cucumber into thick rounds. Top each round with a little crumbled feta. Add a small drizzle of olive oil and a crack of pepper. Serve as bite-sized snacks.' },
  { id: 'r48', title: 'Hard-boiled eggs with salt', meal: 'snack', emoji: '🥚', minutes: 10, ingredientIds: ['egg'], steps: 'Lower 2 eggs into boiling water and cook for 9 minutes for firm yolks, then cool them under cold water. Peel and halve the eggs. Sprinkle with a little sea salt and eat.' },
  { id: 'r49', title: 'Dark chocolate & walnuts', meal: 'snack', emoji: '🍫', minutes: 1, ingredientIds: ['dark_chocolate', 'walnuts'], steps: 'Break off about 30g of dark chocolate (85% or higher). Serve it with a small handful of walnuts. Enjoy slowly as a satisfying, low-FODMAP treat.' },
  { id: 'r50', title: 'Pumpkin seed & kiwi bowl', meal: 'snack', emoji: '🥝', minutes: 2, ingredientIds: ['kiwi', 'pumpkin_seeds', 'lactose_free_yogurt'], steps: 'Spoon lactose-free yogurt into a bowl. Peel and slice a kiwi and lay it over the top. Scatter over a spoon of pumpkin seeds for crunch. Eat straight away.' },
];

// Pick today's 3-4 suggested meals deterministically per day
function todaysMeals(seedNum) {
  const breakfasts = RECIPES.filter(r => r.meal === 'breakfast');
  const lunches = RECIPES.filter(r => r.meal === 'lunch');
  const dinners = RECIPES.filter(r => r.meal === 'dinner');
  const snacks = RECIPES.filter(r => r.meal === 'snack');
  const pick = (arr, offset) => arr[(seedNum + offset) % arr.length];
  return [pick(breakfasts, 0), pick(lunches, 1), pick(dinners, 2), pick(snacks, 3)];
}


// Per-ingredient portion sizes. Each food carries a `category` (assigned in FOODS);
// its S/M/L values come from here, so every ingredient has its own independent portion
// instead of one value split across the whole plate. M is the default size.
// `unit` drives display only — the stored portionG is the raw value below.
const CATEGORY_PORTIONS = {
  protein:        { S: 80,  M: 150, L: 250, unit: 'g' },
  eggs:           { S: 1,   M: 2,   L: 3,   unit: 'units' },
  processed_meat: { S: 30,  M: 60,  L: 100, unit: 'g' },
  vegetables:     { S: 50,  M: 100, L: 180, unit: 'g' },
  fruit:          { S: 40,  M: 80,  L: 150, unit: 'g' },
  dried_fruit:    { S: 15,  M: 30,  L: 50,  unit: 'g' },
  grains:         { S: 60,  M: 120, L: 200, unit: 'g' },
  cereal:         { S: 30,  M: 60,  L: 100, unit: 'g' },
  bread:          { S: 1,   M: 2,   L: 3,   unit: 'slices' },
  dairy_liquid:   { S: 50,  M: 100, L: 200, unit: 'ml' },
  dairy_solid:    { S: 20,  M: 60,  L: 120, unit: 'g' },
  legumes:        { S: 40,  M: 80,  L: 120, unit: 'g' },
  nuts_seeds:     { S: 10,  M: 25,  L: 50,  unit: 'g' },
  condiments:     { S: 5,   M: 15,  L: 30,  unit: 'g' },
  herbs:          { S: 1,   M: 3,   L: 8,   unit: 'g' },
  sauces:         { S: 10,  M: 30,  L: 60,  unit: 'ml' },
  soups:          { S: 100, M: 250, L: 400, unit: 'ml' },
  snacks:         { S: 20,  M: 40,  L: 80,  unit: 'g' },
  spreads:        { S: 10,  M: 25,  L: 50,  unit: 'g' },
  pickles:        { S: 15,  M: 30,  L: 60,  unit: 'g' },
  sweets:         { S: 10,  M: 25,  L: 50,  unit: 'g' },
  desserts:       { S: 50,  M: 100, L: 180, unit: 'g' },
  fermented:      { S: 50,  M: 100, L: 200, unit: 'g' },
  supplements:    { S: 15,  M: 35,  L: 60,  unit: 'g' },
  hot_drinks:     { S: 30,  M: 120, L: 250, unit: 'ml' },
  cold_drinks:    { S: 100, M: 200, L: 350, unit: 'ml' },
  sweeteners:     { S: 2,   M: 5,   L: 10,  unit: 'g' },
  // Not in the source table — covers prepared main-course dishes (pizza, curries,
  // burgers, stir-fries, etc.) that don't map to a single ingredient category.
  prepared_dish:  { S: 150, M: 300, L: 450, unit: 'g' },
};

// Resolve a food's portion category, with a safe fallback for custom/un-tagged foods.
function foodCategory(food) {
  return (food && CATEGORY_PORTIONS[food.category]) ? food.category : 'vegetables';
}
// Gram/unit value for a category + size ('S' | 'M' | 'L'). Defaults to M.
function portionForSize(category, size) {
  const cp = CATEGORY_PORTIONS[category] || CATEGORY_PORTIONS.vegetables;
  return cp[size] != null ? cp[size] : cp.M;
}
// Piece count each size maps to for foods eaten as whole units (apple, pear, egg…).
const PIECE_COUNTS = { S: 1, M: 2, L: 3 };
// Grams STORED for a food at a given size. Foods with a `pieceG` (avg grams per piece)
// are counted in whole pieces but stored as grams (pieces × pieceG) so the FODMAP
// verdict, which is gram-based, stays accurate. Everything else uses its category value.
function portionForItem(food, size) {
  if (food && food.pieceG) return countForSize(food.id, size) * food.pieceG;
  if (food && food.portions) return food.portions[size] != null ? food.portions[size] : food.portions.M;  // per-food S/M/L override
  return portionForSize(foodCategory(food), size);
}
// Unit count for a food/dish at a given size — uses its DISH_PIECE count table if it has
// one (e.g. burrito ½/1/2), otherwise the default 1/2/3.
function countForSize(id, size) {
  const dp = DISH_PIECE[id];
  return ((dp && dp.counts) || PIECE_COUNTS)[size];
}
// Build a fresh meal item for a food id, at its default (M) portion. For counted dishes,
// M maps to a sensible default via their count table (e.g. 1 burrito, 2 tacos).
function makeMealItem(foodId) {
  const food = FOODS.find(f => f.id === foodId);
  return { foodId, size: 'M', portionG: portionForItem(food, 'M') };
}
// "2 pieces" / "2 slices" — localized count word so no English leaks into other locales.
function countLabel(n, kind, t) {
  const key = kind === 'slices' ? (n === 1 ? 'unit_slice_one' : 'unit_slice_other') : (n === 1 ? 'unit_piece_one' : 'unit_piece_other');
  return n + ' ' + t(key);
}
// The label shown on a food's S/M/L button. Counted foods read as pieces ("2 pieces");
// gram/ml foods read as amounts ("80 g"). Small is a ceiling ("… or less"), Large a
// floor ("… or more"), Medium the exact amount.
function itemSizeLabel(food, sizeId, t, lang) {
  let base;
  if (food && DISH_PIECE[food.id]) {
    const n = countForSize(food.id, sizeId);
    base = fmtCount(n) + ' ' + dishUnitWord(food.id, n, lang || 'en');   // e.g. "2 tacos", "½ burrito", "1 pretzel"
  } else if (food && food.pieceG) {
    base = countLabel(PIECE_COUNTS[sizeId], 'units', t);
  } else {
    const cp = (food && food.portions) || CATEGORY_PORTIONS[foodCategory(food)];
    base = (cp.unit === 'g' || cp.unit === 'ml') ? cp[sizeId] + ' ' + cp.unit : countLabel(cp[sizeId], cp.unit, t);
  }
  if (sizeId === 'S') return base + ' ' + t('portion_or_less');
  if (sizeId === 'L') return base + ' ' + t('portion_or_more');
  return base;
}

// Ingredient breakdown for prepared dishes: dishId -> [[foodId, grams], ...] for a
// standard (M) serving. Logging a dish expands into these ingredients (scaled by the
// chosen S/M/L), so the meal shows the dish name with a per-ingredient FODMAP verdict —
// surfacing hidden triggers like onion, garlic, wheat and dairy. Dishes not listed here
// (single-ingredient ones) log as themselves.
const DISH_INGREDIENTS = {
  pizza: [['pizza_dough', 180], ['mozzarella', 70], ['tomato', 50]],
  pinsa: [['pinsa_dough', 180], ['mozzarella', 70], ['tomato', 50]],
  lasagna: [['pasta', 150], ['ground_beef', 80], ['tomato', 50], ['onion', 30], ['milk', 60], ['parmesan', 15]],
  spaghetti_bolognese: [['pasta', 180], ['ground_beef', 80], ['tomato', 60], ['onion', 30], ['garlic', 4]],
  spaghetti_carbonara: [['pasta', 180], ['egg', 50], ['bacon', 40], ['parmesan', 20]],
  risotto: [['rice', 200], ['onion', 30], ['parmesan', 20], ['butter', 15]],
  caprese_salad: [['tomato', 90], ['mozzarella', 80], ['olive_oil', 8]],
  minestrone: [['pasta', 40], ['tomato', 60], ['onion', 30], ['celery', 30], ['carrot', 40], ['kidney_beans', 50]],
  tiramisu: [['bread', 40], ['cream_cheese', 45], ['egg', 20], ['sugar', 15], ['coffee', 20]],  // per slice
  cheeseburger: [['bread', 90], ['ground_beef', 100], ['cheddar', 25], ['onion', 20], ['tomato', 20]],
  french_fries: [['potato', 200], ['olive_oil', 15]],
  hot_dog: [['bread', 60], ['bratwurst', 60], ['onion', 15], ['mustard', 10]],
  mac_cheese: [['pasta', 180], ['cheddar', 50], ['milk', 60], ['butter', 15]],
  pancakes: [['bread', 40], ['egg', 18], ['milk', 30], ['maple', 8]],  // per single pancake
  club_sandwich: [['bread', 90], ['chicken', 60], ['bacon', 20], ['tomato', 20], ['lettuce', 15], ['mayo', 15]],
  caesar_salad: [['lettuce', 100], ['chicken', 70], ['parmesan', 15], ['bread', 30], ['garlic', 3]],
  bagel_cream_cheese: [['bread', 100], ['cream_cheese', 40]],
  bbq_ribs: [['pork', 200], ['honey', 15], ['garlic', 4], ['onion', 10]],
  buffalo_wings: [['chicken', 150], ['butter', 15], ['garlic', 3]],
  cobb_salad: [['lettuce', 90], ['chicken', 60], ['egg', 50], ['bacon', 20], ['avocado', 40], ['blue_cheese', 20]],
  fried_rice: [['rice', 200], ['egg', 40], ['spring_onion', 15], ['garlic', 4], ['soy_sauce', 10], ['pepper_red', 30]],
  kung_pao_chicken: [['chicken', 150], ['peanuts', 25], ['pepper_red', 40], ['garlic', 4], ['spring_onion', 15], ['soy_sauce', 12]],
  sweet_sour_pork: [['pork', 150], ['pepper_red', 40], ['pineapple', 40], ['onion', 25], ['sugar', 15], ['tomato', 20]],
  chow_mein: [['pasta', 180], ['chicken', 60], ['cabbage_white', 40], ['spring_onion', 15], ['garlic', 4], ['soy_sauce', 12]],
  spring_rolls: [['bread', 30], ['cabbage_white', 20], ['carrot', 15], ['garlic', 2], ['olive_oil', 5]],  // per single roll
  dumplings: [['bread', 80], ['pork', 60], ['cabbage_white', 30], ['garlic', 3], ['ginger', 3]],
  mapo_tofu: [['tofu', 150], ['ground_beef', 40], ['garlic', 5], ['spring_onion', 15], ['soy_sauce', 12]],
  wonton_soup: [['bread', 60], ['pork', 40], ['spring_onion', 10], ['garlic', 3]],
  beef_broccoli: [['beef', 120], ['broccoli', 80], ['garlic', 4], ['soy_sauce', 12], ['spring_onion', 10]],
  steamed_dumplings_shrimp: [['rice', 40], ['shrimp', 80], ['garlic', 3], ['ginger', 2]],
  butter_chicken: [['chicken', 150], ['tomato', 60], ['milk', 60], ['onion', 30], ['garlic', 5], ['butter', 15]],
  chicken_tikka_masala: [['chicken', 150], ['tomato', 60], ['milk', 50], ['onion', 30], ['garlic', 5]],
  palak_paneer: [['spinach', 120], ['mozzarella', 60], ['onion', 30], ['garlic', 5]],
  dal_lentil: [['lentils', 120], ['onion', 30], ['garlic', 5], ['tomato', 30], ['butter', 10]],
  chana_masala: [['chickpeas', 130], ['onion', 30], ['garlic', 5], ['tomato', 40]],
  naan: [['bread', 90], ['yogurt', 15]],
  samosa: [['bread', 45], ['potato', 40], ['onion', 12], ['garlic', 2]],  // per single samosa
  biryani: [['rice', 200], ['meat_lamb_chicken', 80], ['onion', 30], ['garlic', 4], ['yogurt', 20]],
  tandoori_chicken: [['chicken', 180], ['yogurt', 25], ['garlic', 4]],
  aloo_gobi: [['potato', 100], ['cauliflower', 100], ['onion', 25], ['garlic', 4]],
  raita: [['yogurt', 100], ['cucumber', 30]],
  plain_dosa: [['rice', 100], ['lentils', 25]],  // per single dosa
  kebab: [['flatbread', 100], ['meat_lamb_chicken', 100], ['onion', 20], ['tomato', 20], ['lettuce', 15], ['cabbage_white', 20], ['garlic', 3]],
  schnitzel: [['meat_veal_pork', 150], ['bread', 40], ['egg', 20]],
  croissant: [['bread', 70], ['butter', 25]],
  quiche: [['bread', 35], ['egg', 35], ['milk', 35], ['cheddar', 18], ['onion', 12], ['bacon', 12]],  // per slice
  paella: [['rice', 200], ['shrimp', 50], ['chicken', 50], ['pepper_red', 30], ['onion', 25], ['garlic', 4]],
  tortilla_espanola: [['potato', 150], ['egg', 80], ['onion', 40], ['olive_oil', 15]],
  fish_and_chips: [['white_fish', 130], ['potato', 200], ['bread', 30], ['olive_oil', 15]],
  goulash: [['meat_beef_pork', 150], ['onion', 40], ['pepper_red', 40], ['tomato', 30], ['garlic', 4], ['potato', 60]],
  moussaka: [['eggplant', 120], ['ground_beef', 80], ['tomato', 40], ['onion', 30], ['milk', 60], ['cheddar', 20]],
  greek_salad: [['cucumber', 60], ['tomato', 80], ['feta', 50], ['olives', 20], ['onion', 20], ['olive_oil', 10]],
  crepe: [['bread', 45], ['egg', 20], ['milk', 45], ['butter', 6]],  // per single crêpe
  fried_chicken: [['chicken', 160], ['bread', 30], ['olive_oil', 15]],
  burrito: [['flatbread', 120], ['ground_beef', 80], ['kidney_beans', 50], ['cheddar', 30], ['tomato', 20], ['onion', 20]],  // large wheat flour tortilla
  taco: [['corn_tortilla', 30], ['ground_beef', 35], ['cheddar', 10], ['tomato', 10], ['onion', 8], ['lettuce', 8]],  // per single taco (corn tortilla)
  taco_chicken: [['corn_tortilla', 30], ['chicken', 35], ['cheddar', 10], ['tomato', 10], ['onion', 8], ['lettuce', 8]],  // per single taco
  taco_fish: [['corn_tortilla', 30], ['white_fish', 40], ['cabbage_white', 12], ['tomato', 8], ['onion', 6], ['mayo', 8]],  // per single taco (fish + slaw + crema)
  taco_pork: [['corn_tortilla', 30], ['pork', 40], ['pineapple', 15], ['onion', 8], ['tomato', 8]],  // per single taco (al pastor)
  burger: [['bread', 90], ['ground_beef', 100], ['lettuce', 15], ['tomato', 20], ['onion', 15]],  // plain base — add cheese/bacon/sauce
  burger_vegan: [['bread', 90], ['plant_patty', 100], ['lettuce', 15], ['tomato', 20], ['onion', 15]],  // plain base — add cheese/sauce
  gyros: [['flatbread', 100], ['meat_pork_chicken', 100], ['tomato', 25], ['onion', 20], ['tzatziki', 30]],
  souvlaki: [['flatbread', 90], ['meat_pork_chicken', 120], ['tomato', 20], ['onion', 15], ['tzatziki', 25]],
  falafel_wrap: [['flatbread', 80], ['chickpeas', 90], ['tomato', 20], ['lettuce', 15], ['tahini', 20], ['onion', 10]],
  churros: [['bread', 80], ['sugar', 18], ['olive_oil', 10]],  // per portion of a few sticks
  langos: [['flatbread', 130], ['olive_oil', 15], ['cheddar', 25], ['garlic', 4]],  // fried flatbread + sour cream/cheese/garlic
  pierogi: [['bread', 110], ['potato', 60], ['cream_cheese', 30], ['onion', 15]],  // per plate (ruskie-style)
  arepa_de_queso: [['sweet_corn', 75], ['mozzarella', 35]],  // per single arepa (corn dough, not a tortilla — shaped as a thick corn cake)
  empanada: [['sweet_corn', 50], ['ground_beef', 30], ['onion', 10]],  // per single empanada (corn masa + filling, Venezuelan/Colombian)
  nachos: [['corn_tortilla', 60], ['cheddar', 40], ['tomato', 20], ['onion', 15], ['kidney_beans', 40]],  // fried corn tortilla chips
  donut: [['bread', 55], ['sugar', 15], ['butter', 8]],  // per single donut
  apple_pie: [['apple', 70], ['bread', 45], ['sugar', 12], ['butter', 8]],  // per slice
  cheesecake: [['cream_cheese', 70], ['bread', 30], ['sugar', 18], ['egg', 12]],  // per slice
  chili_con_carne: [['ground_beef', 100], ['kidney_beans', 80], ['tomato', 60], ['onion', 35], ['garlic', 5], ['pepper_red', 30]],
  scrambled_eggs: [['egg', 100], ['butter', 10]],
  coleslaw: [['cabbage_white', 90], ['carrot', 40], ['mayo', 25]],
  general_tso_chicken: [['chicken', 150], ['sugar', 15], ['garlic', 4], ['spring_onion', 12], ['soy_sauce', 12]],
  lo_mein: [['pasta', 180], ['chicken', 60], ['cabbage_white', 40], ['spring_onion', 15], ['garlic', 4], ['soy_sauce', 12]],
  peking_duck: [['duck', 120], ['bread', 80], ['spring_onion', 20], ['honey', 10]],
  hot_sour_soup: [['tofu', 60], ['mushroom', 40], ['egg', 30], ['spring_onion', 10], ['soy_sauce', 12]],
  char_siu: [['pork', 180], ['honey', 15], ['garlic', 4], ['soy_sauce', 12]],
  egg_drop_soup: [['egg', 50], ['spring_onion', 10], ['garlic', 2]],
  salmon_nigiri: [['rice', 90], ['salmon', 40]],
  california_roll: [['rice', 100], ['avocado', 40], ['shellfish', 30], ['cucumber', 20]],
  ramen: [['pasta', 180], ['pork', 60], ['egg', 40], ['spring_onion', 15], ['garlic', 4], ['soy_sauce', 12]],
  teriyaki_chicken: [['chicken', 150], ['rice', 100], ['honey', 12], ['soy_sauce', 12], ['garlic', 3]],
  miso_soup: [['tofu', 40], ['spring_onion', 10], ['soy_sauce', 10]],
  tempura: [['shrimp', 80], ['bread', 40], ['zucchini', 30], ['pepper_red', 20], ['olive_oil', 15]],
  pad_thai: [['rice_noodle', 180], ['shrimp', 50], ['egg', 40], ['peanuts', 20], ['spring_onion', 15], ['garlic', 4], ['soy_sauce', 10]],
  green_curry: [['chicken', 120], ['coconut_water', 60], ['pepper_red', 30], ['eggplant', 40], ['onion', 20], ['garlic', 4]],
  tom_yum: [['shrimp', 60], ['mushroom', 40], ['tomato', 20], ['garlic', 3], ['spring_onion', 10]],
  pho: [['rice_noodle', 180], ['meat_beef_chicken', 60], ['spring_onion', 15], ['onion', 20], ['ginger', 4]],
  bibimbap: [['rice', 180], ['beef', 60], ['egg', 40], ['spinach', 30], ['carrot', 30], ['mushroom', 30], ['garlic', 4]],
  bulgogi: [['beef', 150], ['onion', 25], ['garlic', 5], ['spring_onion', 12], ['soy_sauce', 12], ['sugar', 8]],
  guacamole: [['avocado', 80], ['tomato', 20], ['onion', 15], ['garlic', 3], ['lemon', 5]],
  quesadilla: [['flatbread', 100], ['cheddar', 40], ['chicken', 40], ['onion', 15]],  // flour-tortilla version
  falafel: [['chickpeas', 120], ['onion', 20], ['garlic', 5], ['olive_oil', 10]],
  shakshuka: [['egg', 100], ['tomato', 80], ['pepper_red', 40], ['onion', 30], ['garlic', 4]],
  poke_bowl: [['rice', 150], ['salmon', 60], ['avocado', 40], ['cucumber', 30], ['soy_sauce', 10]],
};
// S/M/L scales a dish's ingredient amounts around the standard (M) serving.
const DISH_SCALE = { S: 0.5, M: 1, L: 1.5 };
// Dishes counted in their own whole units instead of S/M/L grams. Their DISH_INGREDIENTS
// amounts are PER ONE UNIT; S/M/L map to 1/2/3 units (see PIECE_COUNTS). The label shows
// the localized unit word (e.g. "2 tacos").
// Large handheld items use half/one/two counts (default M = 1); small items eaten in
// multiples use the default 1/2/3 (default M = 2). DISH_INGREDIENTS holds per-1-piece amounts.
const HALF_COUNTS = { S: 0.5, M: 1, L: 2 };
// Shared "slice/portion" unit for cakes, pies, quiches (distinct from a bread slice).
const SLICE_UNIT = { one: { en: 'slice', it: 'fetta', es: 'porción', de: 'Stück', fr: 'part' }, other: { en: 'slices', it: 'fette', es: 'porciones', de: 'Stücke', fr: 'parts' } };
const DISH_PIECE = {
  // Small items typically eaten in 2s–3s → S/M/L = 1/2/3.
  taco: { one: { en: 'taco', it: 'taco', es: 'taco', de: 'Taco', fr: 'taco' }, other: { en: 'tacos', it: 'tacos', es: 'tacos', de: 'Tacos', fr: 'tacos' } },
  taco_chicken: { one: { en: 'taco', it: 'taco', es: 'taco', de: 'Taco', fr: 'taco' }, other: { en: 'tacos', it: 'tacos', es: 'tacos', de: 'Tacos', fr: 'tacos' } },
  taco_fish: { one: { en: 'taco', it: 'taco', es: 'taco', de: 'Taco', fr: 'taco' }, other: { en: 'tacos', it: 'tacos', es: 'tacos', de: 'Tacos', fr: 'tacos' } },
  taco_pork: { one: { en: 'taco', it: 'taco', es: 'taco', de: 'Taco', fr: 'taco' }, other: { en: 'tacos', it: 'tacos', es: 'tacos', de: 'Tacos', fr: 'tacos' } },
  arepa_de_queso: { one: { en: 'arepa', it: 'arepa', es: 'arepa', de: 'Arepa', fr: 'arepa' }, other: { en: 'arepas', it: 'arepe', es: 'arepas', de: 'Arepas', fr: 'arepas' } },
  empanada: { one: { en: 'empanada', it: 'empanada', es: 'empanada', de: 'Empanada', fr: 'empanada' }, other: { en: 'empanadas', it: 'empanadas', es: 'empanadas', de: 'Empanadas', fr: 'empanadas' } },
  samosa: { one: { en: 'samosa', it: 'samosa', es: 'samosa', de: 'Samosa', fr: 'samosa' }, other: { en: 'samosas', it: 'samosa', es: 'samosas', de: 'Samosas', fr: 'samosas' } },
  spring_rolls: { one: { en: 'spring roll', it: 'involtino', es: 'rollito', de: 'Frühlingsrolle', fr: 'rouleau' }, other: { en: 'spring rolls', it: 'involtini', es: 'rollitos', de: 'Frühlingsrollen', fr: 'rouleaux' } },
  pancakes: { one: { en: 'pancake', it: 'pancake', es: 'tortita', de: 'Pfannkuchen', fr: 'pancake' }, other: { en: 'pancakes', it: 'pancake', es: 'tortitas', de: 'Pfannkuchen', fr: 'pancakes' } },
  // Large items where one is a normal serving → S/M/L = ½/1/2.
  pizza: { counts: HALF_COUNTS, one: { en: 'pizza', it: 'pizza', es: 'pizza', de: 'Pizza', fr: 'pizza' }, other: { en: 'pizzas', it: 'pizze', es: 'pizzas', de: 'Pizzen', fr: 'pizzas' } },
  pinsa: { counts: HALF_COUNTS, one: { en: 'pinsa', it: 'pinsa', es: 'pinsa', de: 'Pinsa', fr: 'pinsa' }, other: { en: 'pinsas', it: 'pinse', es: 'pinsas', de: 'Pinsas', fr: 'pinsas' } },
  burrito: { counts: HALF_COUNTS, one: { en: 'burrito', it: 'burrito', es: 'burrito', de: 'Burrito', fr: 'burrito' }, other: { en: 'burritos', it: 'burritos', es: 'burritos', de: 'Burritos', fr: 'burritos' } },
  cheeseburger: { counts: HALF_COUNTS, one: { en: 'burger', it: 'hamburger', es: 'hamburguesa', de: 'Burger', fr: 'burger' }, other: { en: 'burgers', it: 'hamburger', es: 'hamburguesas', de: 'Burger', fr: 'burgers' } },
  hot_dog: { counts: HALF_COUNTS, one: { en: 'hot dog', it: 'hot dog', es: 'hot dog', de: 'Hotdog', fr: 'hot-dog' }, other: { en: 'hot dogs', it: 'hot dog', es: 'hot dogs', de: 'Hotdogs', fr: 'hot-dogs' } },
  kebab: { counts: HALF_COUNTS, one: { en: 'kebab', it: 'kebab', es: 'kebab', de: 'Kebab', fr: 'kebab' }, other: { en: 'kebabs', it: 'kebab', es: 'kebabs', de: 'Kebabs', fr: 'kebabs' } },
  burger: { counts: HALF_COUNTS, one: { en: 'burger', it: 'hamburger', es: 'hamburguesa', de: 'Burger', fr: 'burger' }, other: { en: 'burgers', it: 'hamburger', es: 'hamburguesas', de: 'Burger', fr: 'burgers' } },
  burger_vegan: { counts: HALF_COUNTS, one: { en: 'burger', it: 'hamburger', es: 'hamburguesa', de: 'Burger', fr: 'burger' }, other: { en: 'burgers', it: 'hamburger', es: 'hamburguesas', de: 'Burger', fr: 'burgers' } },
  gyros: { counts: HALF_COUNTS, one: { en: 'gyros', it: 'gyros', es: 'gyros', de: 'Gyros', fr: 'gyros' }, other: { en: 'gyros', it: 'gyros', es: 'gyros', de: 'Gyros', fr: 'gyros' } },
  souvlaki: { counts: HALF_COUNTS, one: { en: 'souvlaki', it: 'souvlaki', es: 'souvlaki', de: 'Souvlaki', fr: 'souvlaki' }, other: { en: 'souvlaki', it: 'souvlaki', es: 'souvlakis', de: 'Souvlaki', fr: 'souvlakis' } },
  falafel_wrap: { counts: HALF_COUNTS, one: { en: 'wrap', it: 'wrap', es: 'wrap', de: 'Wrap', fr: 'wrap' }, other: { en: 'wraps', it: 'wrap', es: 'wraps', de: 'Wraps', fr: 'wraps' } },
  langos: { counts: HALF_COUNTS, one: { en: 'langos', it: 'langos', es: 'langos', de: 'Langos', fr: 'langos' }, other: { en: 'langos', it: 'langos', es: 'langos', de: 'Langos', fr: 'langos' } },
  quesadilla: { counts: HALF_COUNTS, one: { en: 'quesadilla', it: 'quesadilla', es: 'quesadilla', de: 'Quesadilla', fr: 'quesadilla' }, other: { en: 'quesadillas', it: 'quesadillas', es: 'quesadillas', de: 'Quesadillas', fr: 'quesadillas' } },
  bagel_cream_cheese: { counts: HALF_COUNTS, one: { en: 'bagel', it: 'bagel', es: 'bagel', de: 'Bagel', fr: 'bagel' }, other: { en: 'bagels', it: 'bagel', es: 'bagels', de: 'Bagels', fr: 'bagels' } },
  crepe: { counts: HALF_COUNTS, one: { en: 'crêpe', it: 'crêpe', es: 'crepe', de: 'Crêpe', fr: 'crêpe' }, other: { en: 'crêpes', it: 'crêpe', es: 'crepes', de: 'Crêpes', fr: 'crêpes' } },
  plain_dosa: { counts: HALF_COUNTS, one: { en: 'dosa', it: 'dosa', es: 'dosa', de: 'Dosa', fr: 'dosa' }, other: { en: 'dosas', it: 'dosa', es: 'dosas', de: 'Dosas', fr: 'dosas' } },
  donut: { counts: HALF_COUNTS, one: { en: 'donut', it: 'ciambella', es: 'dona', de: 'Donut', fr: 'donut' }, other: { en: 'donuts', it: 'ciambelle', es: 'donas', de: 'Donuts', fr: 'donuts' } },
  club_sandwich: { counts: HALF_COUNTS, one: { en: 'sandwich', it: 'sandwich', es: 'sándwich', de: 'Sandwich', fr: 'sandwich' }, other: { en: 'sandwiches', it: 'sandwich', es: 'sándwiches', de: 'Sandwiches', fr: 'sandwichs' } },
  naan: { counts: HALF_COUNTS, one: { en: 'naan', it: 'naan', es: 'naan', de: 'Naan', fr: 'naan' }, other: { en: 'naans', it: 'naan', es: 'naans', de: 'Naans', fr: 'naans' } },
  croissant: { counts: HALF_COUNTS, one: { en: 'croissant', it: 'croissant', es: 'croissant', de: 'Croissant', fr: 'croissant' }, other: { en: 'croissants', it: 'croissant', es: 'croissants', de: 'Croissants', fr: 'croissants' } },
  // Single bakery foods counted as whole units (not decomposed — they carry a pieceG).
  pretzel: { counts: HALF_COUNTS, one: { en: 'pretzel', it: 'pretzel', es: 'pretzel', de: 'Brezel', fr: 'bretzel' }, other: { en: 'pretzels', it: 'pretzel', es: 'pretzels', de: 'Brezeln', fr: 'bretzels' } },
  // Cakes / pies / quiche — counted by slice (½/1/2 slices).
  quiche: { counts: HALF_COUNTS, one: SLICE_UNIT.one, other: SLICE_UNIT.other },
  cheesecake: { counts: HALF_COUNTS, one: SLICE_UNIT.one, other: SLICE_UNIT.other },
  apple_pie: { counts: HALF_COUNTS, one: SLICE_UNIT.one, other: SLICE_UNIT.other },
  tiramisu: { counts: HALF_COUNTS, one: SLICE_UNIT.one, other: SLICE_UNIT.other },
};
// Localized unit word for a counted dish at a given count (singular for ½ and 1).
function dishUnitWord(dishId, n, lang) {
  const du = DISH_PIECE[dishId]; if (!du) return null;
  const w = n <= 1 ? du.one : du.other;
  return w[lang] || w.en;
}
// Count for display: "½" for 0.5, otherwise the number.
function fmtCount(n) { return n === 0.5 ? '½' : String(n); }
// Ingredient names a dish expands to (localized) — used for the "contains…" hint.
function dishIngredientNames(dishId, lang) {
  return (DISH_INGREDIENTS[dishId] || []).map(([id]) => { const f = FOODS.find(x => x.id === id); return f ? foodName(f, lang) : null; }).filter(Boolean);
}
// Expand any selected dishes into their ingredient items (scaled by the chosen size),
// passing normal foods through unchanged. Returns the flat item list for the FODMAP
// verdict + storage, plus the list of dish ids for the meal's display title.
function resolveMeal(selected) {
  const items = [];
  const dishes = [];
  (selected || []).forEach(it => {
    const recipe = DISH_INGREDIENTS[it.foodId];
    if (recipe) {
      dishes.push(it.foodId);
      // Counted dishes scale by their unit count (e.g. tacos 1/2/3, burrito ½/1/2); others by S/M/L ratio.
      const scale = DISH_PIECE[it.foodId] ? (countForSize(it.foodId, it.size) || 1) : (DISH_SCALE[it.size] || 1);
      // Skip ingredients the user chose to leave out (e.g. onion out of a kebab).
      recipe.forEach(([id, g]) => { if ((it.exclude || []).includes(id)) return; items.push({ foodId: id, size: it.size, portionG: Math.max(1, Math.round(g * scale)) }); });
    } else {
      items.push({ foodId: it.foodId, size: it.size, portionG: it.portionG });
    }
  });
  return { items, dishes };
}

// Split a flat meal-item list back into per-dish groups for display. Each dish claims one
// item per recipe ingredient (so a food shared by two dishes — e.g. tomato in both pizza and
// kebab — is attributed to each once). Items matching no dish recipe are returned as `extras`
// (foods the user added on top of the dishes).
function groupMealItemsByDish(items, mealDishes) {
  const remaining = (items || []).slice();
  const groups = [];
  (mealDishes || []).forEach(did => {
    const recipe = DISH_INGREDIENTS[did] || [];
    const groupItems = [];
    recipe.forEach(([fid]) => {
      const idx = remaining.findIndex(x => x.foodId === fid);
      if (idx >= 0) { groupItems.push(remaining[idx]); remaining.splice(idx, 1); }
    });
    if (groupItems.length) groups.push({ dishId: did, items: groupItems });
  });
  return { groups, extras: remaining };
}

// Food ids the user has actually logged, most-recent first (deduped). Powers the meal
// builder's "recent" row so it reflects real habits instead of a fixed starter list.
// A meal logged as a prepared dish surfaces the DISH itself (e.g. "Kebab"), not its
// internal ingredients — those are represented by the dish. Plain foods and any extras
// added on top still appear individually.
function recentFoodIds(log, n) {
  const meals = (log || []).filter(e => e.type === 'meal' && Array.isArray(e.items))
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  const seen = [];
  const add = (id) => { if (id && !seen.includes(id) && FOODS.some(f => f.id === id)) seen.push(id); };
  for (const m of meals) {
    const dishes = Array.isArray(m.mealDishes) ? m.mealDishes : [];
    const dishIngredientIds = new Set();
    dishes.forEach(did => (DISH_INGREDIENTS[did] || []).forEach(([fid]) => dishIngredientIds.add(fid)));
    dishes.forEach(add);                                                  // the dishes (e.g. kebab)
    for (const it of m.items) if (!dishIngredientIds.has(it.foodId)) add(it.foodId);  // plain foods + extras
    if (seen.length >= n) break;
  }
  return seen.slice(0, n);
}

// Distinct meals the user has logged (by food combination), most-recent first — lets the
// builder offer one-tap re-logging of habitual meals.
function recentMeals(log, n) {
  const meals = (log || []).filter(e => e.type === 'meal' && Array.isArray(e.items) && e.items.length > 0)
    .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
  const seen = new Set();
  const out = [];
  for (const m of meals) {
    // Rebuild the selection the way it was logged — whole dish(es) plus any foods added on
    // top — instead of the flattened ingredient list. This keeps prepared dishes (kebab,
    // pizza…) as single items, so the card shows the dish and re-logging preserves its dish
    // identity rather than splitting it back into raw ingredients.
    const dishes = (Array.isArray(m.mealDishes) ? m.mealDishes : []).filter(id => FOODS.some(f => f.id === id));
    const extras = groupMealItemsByDish(m.items, m.mealDishes).extras.map(it => it.foodId);
    const ids = [...dishes, ...extras].filter(id => FOODS.some(f => f.id === id));
    if (ids.length === 0) continue;
    const sig = ids.slice().sort().join(',');
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ ids });
    if (out.length >= n) break;
  }
  return out;
}

// Collision-resistant, globally-unique-ish id for records that will sync to a backend later.
// (bare Date.now() collides across devices/users — this adds a random suffix.) Roughly
// time-sortable via the base36 timestamp prefix.
function uid(prefix) {
  return (prefix || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Meal-of-day tag. Auto-defaults from the log time; user can override. One extra field on the
// meal entry (sync-ready as-is — entries get ownerId/updatedAt at sync time).
const MEAL_TYPES = [
  { id: 'breakfast' },
  { id: 'lunch' },
  { id: 'dinner' },
  { id: 'snack' },
];
function defaultMealType(date) {
  const h = (date || new Date()).getHours();
  if (h >= 4 && h < 11) return 'breakfast';
  if (h >= 11 && h < 15) return 'lunch';
  if (h >= 15 && h < 22) return 'dinner';
  return 'snack';
}

// Short "why" for a Moderate/High verdict: the driving food(s), or stacking of moderates.
// Shared by the meal builder and the history timeline.
function mealReasonText(meal, lang, t) {
  if (!meal || meal.overall === 'low') return '';
  const highs = meal.items.filter(v => v.verdictCat === 'high');
  if (highs.length > 0) {
    const names = highs.slice(0, 2).map(v => foodName(v, lang));
    const extra = highs.length - names.length;
    return t('meal_reason_from', { food: names.join(', ') + (extra > 0 ? ' +' + extra : '') });
  }
  if (meal.stacking.length > 0) return t('meal_reason_stack');
  const mod = meal.items.find(v => v.verdictCat === 'mod');
  return mod ? t('meal_reason_from', { food: foodName(mod, lang) }) : '';
}

// Explains WHY a logged meal is high/moderate: names the culprit foods and the FODMAP
// group(s) each one contains (localized). Used on the Today screen under the meal row.
function mealWhyText(meal, lang) {
  if (!meal || meal.overall === 'low') return '';
  let culprits = meal.items.filter(v => v.verdictCat === 'high');
  if (culprits.length === 0) culprits = meal.items.filter(v => v.verdictCat === 'mod');
  culprits = culprits.filter(v => (v.groups || []).length > 0);
  if (culprits.length > 0) {
    return culprits.slice(0, 3).map(v => {
      const gs = v.groups.map(g => groupInfoText(g, lang).name).filter(Boolean).join(', ');
      return foodName(v, lang) + (gs ? ' — ' + gs : '');
    }).join(' · ');
  }
  // No single high/mod food — the meal is only high because several moderate FODMAPs stack.
  if (meal.stacking && meal.stacking.length) {
    return meal.stacking.map(g => groupInfoText(g, lang).name).filter(Boolean).join(', ');
  }
  return '';
}

// Custom foods the user adds live in the same FOODS array so every lookup (search, verdict,
// timeline, edit) just works. Deduped so a re-load doesn't add them twice.
function registerCustomFood(food) {
  if (food && food.id && !FOODS.some(f => f.id === food.id)) FOODS.push(food);
}

// `reintroProgress` (optional) personalises the verdict: a high/moderate food whose
// every FODMAP group the user has tested and tolerated becomes low-FODMAP *for them*.
function categorizeMeal(items, reintroProgress) {
  const rp = reintroProgress || null;
  const verdicts = items.map(({ foodId, portionG }) => {
    const food = FOODS.find(f => f.id === foodId);
    if (!food) return null;
    let cat;
    if (food.custom) cat = food.cat;               // user-declared level, portion-independent
    else if (food.cat === 'high') cat = 'high';
    else if (food.cat === 'low') cat = (!food.lowT || portionG <= food.lowT) ? 'low' : 'mod';
    else {
      if (food.lowT && portionG <= food.lowT) cat = 'low';
      else if (food.modT && portionG <= food.modT) cat = 'mod';
      else cat = 'high';
    }
    // Personalise: if the user tolerates *every* FODMAP group behind this food, it's safe for them.
    if (rp && cat !== 'low' && food.groups && food.groups.length > 0 && food.groups.every(g => rp[g] === 'tolerated')) cat = 'low';
    return Object.assign({}, food, { portionG, verdictCat: cat });
  }).filter(Boolean);

  const groupLoad = {};
  verdicts.forEach(v => {
    const contrib = v.verdictCat === 'high' ? 2 : v.verdictCat === 'mod' ? 1 : 0.3;
    v.groups.forEach(g => { groupLoad[g] = (groupLoad[g] || 0) + contrib; });
  });
  const stacking = Object.keys(groupLoad).filter(g => groupLoad[g] > 1.5);

  let overall = 'low';
  if (verdicts.some(v => v.verdictCat === 'high')) overall = 'high';
  else if (verdicts.some(v => v.verdictCat === 'mod') || stacking.length > 0) overall = 'mod';
  return { overall, items: verdicts, stacking };
}

const CAT_COLORS = {
  low: { bg: '#e0f0e0', dot: '#4e7d4e', text: '#2d6a2d' },
  mod: { bg: '#fff4d0', dot: '#d4a040', text: '#8a5a10' },
  high: { bg: '#fde0e0', dot: '#c85050', text: '#a03030' },
};
const CAT_LABELS = { low: 'Low FODMAP', mod: 'Moderate', high: 'High FODMAP' };

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────
// Single source of truth for the visual language: a clinical, stats-forward
// health app (Google Fit credibility) with a warm sage palette and a friendly
// microbe mascot. Reference the THEME object instead of hardcoding hexes so the
// look stays consistent as screens evolve.
const THEME = {
  // Core sage palette
  ink: '#16210f',        // near-black headlines
  primary: '#4e8a55',    // brand green
  primaryDark: '#2d6a2d',
  bg: '#f4f7f2',         // page background (soft sage)
  card: '#ffffff',       // card surface
  cardBorder: '#e0ece0', // hairline border (outlined cards)
  textMuted: '#647264',  // captions / meta
  textSoft: '#5e7060',   // secondary body
  // Accents
  amber: '#d4a040',
  amberBg: '#fbeed3',
  amberText: '#a05a10',
  red: '#c85050',
  redBg: '#fde0e0',
  redText: '#a03030',
  streakBg: '#fde8d0',
  streakText: '#a05a10',
  // Radii
  rCard: 12,   // M3 card default (medium corner, 12dp)
  rTile: 18,
  rPill: 12,
};

// ─── MASCOT: FLORA ─────────────────────────────────────────────────────
// A friendly probiotic microbe — the face of GutBloom and its gamification.
//   `mood`: 'good' | 'soso' | 'bad' — today's expression (legacy 'happy'/'queasy' ok)
//   `form`: 'spore' | 'sprout' | 'grown' | 'thriving' — evolution stage (level)
// Always recognisably Flora: the face stays constant while the body grows and
// gains cilia, leaves, sparkles and a glow as she levels up.
// A fine, wavy cilia fringe all around the body (paramecium-style) — reads as a
// microbe rather than a sun. `count` cilia are spread evenly; each is a short
// stroke curving the same rotational way so she looks like she's gently swimming.
function ciliaFringe(rBody, count, cx = 75, cy = 75, len = 12, bend = 3.4, arc = null) {
  const r0 = rBody - 2, r1 = rBody + len;
  const paths = [];
  for (let i = 0; i < count; i++) {
    let a;
    if (arc) { const t = count === 1 ? 0.5 : i / (count - 1); a = (arc[0] + (arc[1] - arc[0]) * t) * Math.PI / 180; }
    else a = (i / count) * 2 * Math.PI - Math.PI / 2;
    const bx = cx + Math.cos(a) * r0, by = cy + Math.sin(a) * r0;
    const tx = cx + Math.cos(a) * r1, ty = cy + Math.sin(a) * r1;
    const px = -Math.sin(a), py = Math.cos(a);
    const mx = (bx + tx) / 2 + px * bend, my = (by + ty) / 2 + py * bend;
    paths.push(`M${bx.toFixed(1)} ${by.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${tx.toFixed(1)} ${ty.toFixed(1)}`);
  }
  return paths;
}
// Turn a straight cilium segment into a gently curved one, so the scene
// illustrations match the hero's wavy fringe instead of straight sun-rays.
function wavyPath(x1, y1, x2, y2, bend = 2.6) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len;
  return `M${x1} ${y1} Q${(mx + px * bend).toFixed(1)} ${(my + py * bend).toFixed(1)} ${x2} ${y2}`;
}
const SPECKS = [[-17, -15, 7], [20, 15, 9], [22, -15, 5], [-15, 14, 4]];
const FORMS = {
  spore:    { rBody: 34, body: '#aec5a6', inner: '#d2e3cd', cilia: 0,  leaves: 0, glow: false, sparkle: false, specks: 1 },
  sprout:   { rBody: 42, body: '#7aa572', inner: '#c4e0c4', cilia: 12, leaves: 2, glow: false, sparkle: false, specks: 2 },
  grown:    { rBody: 50, body: '#6fa86f', inner: '#bfe0bf', cilia: 18, leaves: 0, glow: false, sparkle: false, specks: 3 },
  thriving: { rBody: 50, body: '#5fa85f', inner: '#b8e0b8', cilia: 18, leaves: 3, glow: true,  sparkle: true,  specks: 4 },
};
function Flora({ size = 140, mood = 'good', form = 'grown', blink = false }) {
  const m = mood === 'happy' ? 'good' : mood === 'queasy' ? 'bad' : mood;
  const bad = m === 'bad';
  const soso = m === 'soso';
  const f = FORMS[form] || FORMS.grown;

  const bodyFill = bad ? '#b3c2a4' : f.body;
  const inner = bad ? '#d3e0cb' : f.inner;
  const k = f.rBody / 50; // speck scale
  const ciliaPaths = f.cilia > 0 ? ciliaFringe(f.rBody, f.cilia) : [];
  const mouth = bad ? 'M66 89 Q75 81 84 89' : soso ? 'M66 86 L84 86' : 'M66 84 Q75 93 84 84';

  return (
    <Svg width={size} height={size} viewBox="0 0 150 150">
      {f.glow && <Circle cx="75" cy="77" r="62" fill="#e3f1e3" />}
      {/* leaves on top */}
      {f.leaves >= 2 && (
        <>
          <Ellipse cx="66" cy="24" rx="6" ry="13" fill="#4e7d4e" transform="rotate(-28 66 24)" />
          <Ellipse cx="84" cy="24" rx="6" ry="13" fill="#6fa06f" transform="rotate(28 84 24)" />
        </>
      )}
      {f.leaves >= 3 && (
        <>
          <Ellipse cx="75" cy="13" rx="6" ry="14" fill="#4e944e" />
          <Ellipse cx="55" cy="22" rx="5" ry="11" fill="#6fb86f" transform="rotate(-38 55 22)" />
          <Ellipse cx="95" cy="22" rx="5" ry="11" fill="#6fb86f" transform="rotate(38 95 22)" />
        </>
      )}
      {/* cilia — a fine, wavy fringe all around (paramecium-style) */}
      {ciliaPaths.length > 0 && (
        <G stroke={THEME.primary} strokeWidth={3} strokeLinecap="round" fill="none">
          {ciliaPaths.map((d, i) => <Path key={i} d={d} />)}
        </G>
      )}
      {/* body */}
      <Circle cx="75" cy="75" r={f.rBody} fill={bodyFill} />
      <Circle cx="75" cy="77" r={f.rBody * 0.68} fill={inner} />
      {/* inner specks */}
      {SPECKS.slice(0, f.specks).map((sp, i) => (
        <Circle key={i} cx={75 + sp[0] * k} cy={75 + sp[1] * k} r={sp[2] * k} fill="#8cc08c" />
      ))}
      {/* eyes */}
      {bad ? (
        <>
          <Path d="M57 70 L69 74" stroke={THEME.ink} strokeWidth={3.4} strokeLinecap="round" />
          <Path d="M93 70 L81 74" stroke={THEME.ink} strokeWidth={3.4} strokeLinecap="round" />
        </>
      ) : blink ? (
        <>
          <Path d="M57 72 Q63 77 69 72" stroke={THEME.ink} strokeWidth={3.4} fill="none" strokeLinecap="round" />
          <Path d="M81 72 Q87 77 93 72" stroke={THEME.ink} strokeWidth={3.4} fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <Circle cx="63" cy="72" r="6.5" fill={THEME.ink} />
          <Circle cx="87" cy="72" r="6.5" fill={THEME.ink} />
          <Circle cx="65" cy="69.5" r="2.2" fill="#fff" />
          <Circle cx="89" cy="69.5" r="2.2" fill="#fff" />
        </>
      )}
      {/* cheeks */}
      {!bad && (
        <>
          <Ellipse cx="55" cy="83" rx="5" ry="3.2" fill="#f2b6b6" />
          <Ellipse cx="95" cy="83" rx="5" ry="3.2" fill="#f2b6b6" />
        </>
      )}
      {/* sweat drop */}
      {bad && <Path d="M108 50 q5 8 0 12 q-5 -4 0 -12 Z" fill="#8fc4e8" />}
      {/* sparkles */}
      {f.sparkle && (
        <>
          <Path d="M124 28 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" fill="#f4c84a" />
          <Path d="M20 38 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" fill="#f4c84a" />
        </>
      )}
      {/* mouth */}
      <Path d={mouth} stroke={THEME.ink} strokeWidth={3.4} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

// Flora that gently breathes (a subtle scale pulse) and blinks at natural,
// slightly-random intervals. Used where she's the hero of the screen (the Today
// mood card) to feel alive without being distracting.
function BlinkingFlora(props) {
  const [blink, setBlink] = useState(false);
  const breathe = useRef(new Animated.Value(0)).current; // bob + breathe
  const sway = useRef(new Animated.Value(0)).current;     // gentle side tilt
  useEffect(() => {
    let blinkTimer, openTimer;
    const schedule = () => {
      blinkTimer = setTimeout(() => {
        setBlink(true);
        openTimer = setTimeout(() => { setBlink(false); schedule(); }, 140);
      }, 2400 + Math.random() * 2600);
    };
    schedule();
    const mkLoop = (val, dur) => Animated.loop(Animated.sequence([
      Animated.timing(val, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(val, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const l1 = mkLoop(breathe, 1900);
    const l2 = mkLoop(sway, 2600);
    l1.start(); l2.start();
    return () => { clearTimeout(blinkTimer); clearTimeout(openTimer); l1.stop(); l2.stop(); };
  }, []);
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const translateY = breathe.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  const rotate = sway.interpolate({ inputRange: [0, 1], outputRange: ['-2.5deg', '2.5deg'] });
  return (
    <Animated.View style={{ transform: [{ translateY }, { scale }, { rotate }] }}>
      <Flora {...props} blink={blink} />
    </Animated.View>
  );
}

// Branded launch animation: Flora springs in and breathes while a ring of
// little probiotic dots orbits her (an on-brand spinner), and the wordmark
// fades up. Shown while the app hydrates.
function SplashScreen({ t }) {
  const enter = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  // Hand off from the native launch splash: now that our (identically-coloured) JS
  // splash is on screen, hide the native one. The green background matches, so there
  // is no visible flash between the two.
  useEffect(() => { NativeSplash.hideAsync().catch(() => {}); }, []);
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, friction: 5, tension: 55, useNativeDriver: true }).start();
    const o = Animated.loop(Animated.timing(orbit, { toValue: 1, duration: 2200, easing: Easing.linear, useNativeDriver: true }));
    const b = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    o.start(); b.start();
    return () => { o.stop(); b.stop(); };
  }, []);
  const enterScale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const breatheScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const rotate = orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const wordY = enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  const dots = ['#5fb06a', '#f0bd4f', '#ec84ac', '#5fa8e0'];
  const R = 84, C = 90;
  return (
    <SafeAreaProvider>
    <SafeAreaViewSC style={{ flex: 1, backgroundColor: '#e7f3df', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 180, height: 180, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ position: 'absolute', width: 180, height: 180, transform: [{ rotate }] }}>
          {dots.map((c, i) => {
            const a = (i / dots.length) * 2 * Math.PI;
            return <View key={i} style={{ position: 'absolute', left: C + Math.cos(a) * R - 6, top: C + Math.sin(a) * R - 6, width: 12, height: 12, borderRadius: 6, backgroundColor: c }} />;
          })}
        </Animated.View>
        <Animated.View style={{ transform: [{ scale: Animated.multiply(enterScale, breatheScale) }] }}>
          <Flora size={104} mood="good" />
        </Animated.View>
      </View>
      <Animated.View style={{ opacity: enter, transform: [{ translateY: wordY }], alignItems: 'center', marginTop: 6 }}>
        <Text style={{ fontSize: 30, fontWeight: '700', color: THEME.ink, letterSpacing: -0.5 }}>GutBloom</Text>
        <Text style={{ fontSize: 13, color: THEME.textMuted, marginTop: 4 }}>{t('app_tagline')}</Text>
      </Animated.View>
    </SafeAreaViewSC>
    </SafeAreaProvider>
  );
}

// ─── GAMIFICATION ────────────────────────────────────────────────────────
// All progress is *derived* from the log + reintro state (no separate stored
// score), so it can never drift out of sync and needs no schema change.
// Points come from four sources the user chose: symptom-free days, low-FODMAP
// adherence, consistent logging, and completed reintroduction tests.
const POINTS_PER_LEVEL = 100;
function computeGamification(log, reintroProgress) {
  const days = {};
  (log || []).forEach(e => {
    const d = (e.timestamp || '').slice(0, 10);
    if (!d) return;
    if (!days[d]) days[d] = { entries: 0, symptoms: 0, lowMeals: 0 };
    days[d].entries++;
    if (e.type === 'symptom') days[d].symptoms++;
    if (e.type === 'meal') {
      const cat = e.productRisk ? e.productRisk : categorizeMeal(e.items || [], reintroProgress).overall;
      if (cat === 'low') days[d].lowMeals++;
    }
  });
  let logging = 0, symptomFree = 0, adherence = 0;
  Object.keys(days).forEach(d => {
    const day = days[d];
    if (day.entries > 0) logging += 10;                  // showed up
    if (day.entries > 0 && day.symptoms === 0) symptomFree += 20; // calm gut
    adherence += Math.min(day.lowMeals, 3) * 5;          // safe foods (cap/day)
  });
  const testsDone = Object.values(reintroProgress || {}).filter(v => v === 'tolerated' || v === 'trigger').length;
  const reintro = testsDone * 50;
  const points = logging + symptomFree + adherence + reintro;
  const level = Math.floor(points / POINTS_PER_LEVEL) + 1;
  return {
    points, level,
    pointsIntoLevel: points % POINTS_PER_LEVEL,
    toNext: POINTS_PER_LEVEL - (points % POINTS_PER_LEVEL),
    colonySize: Math.max(0, Math.min(12, level - 1)),
    testsDone,
    breakdown: { logging, symptomFree, adherence, reintro },
  };
}
// Flora's evolution form grows with level milestones.
function floraForm(level) {
  if (level >= 7) return 'thriving';
  if (level >= 4) return 'grown';
  if (level >= 2) return 'sprout';
  return 'spore';
}
const FORM_LABELS = { spore: 'Spore', sprout: 'Sprout', grown: 'Grown', thriving: 'Thriving' };

// Current "thriving" streak: consecutive recent days that were logged and had no
// symptoms, ending today (today doesn't break it if not logged yet). Used as the
// maintenance metric once the colony is complete.
function calmStreak(log) {
  const symptomDays = new Set((log || []).filter(e => e.type === 'symptom').map(e => (e.timestamp || '').slice(0, 10)));
  const entryDays = new Set((log || []).map(e => (e.timestamp || '').slice(0, 10)));
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const dt = new Date(); dt.setDate(dt.getDate() - i);
    const key = dt.toISOString().slice(0, 10);
    if (symptomDays.has(key)) break;
    if (!entryDays.has(key)) { if (i === 0) continue; else break; }
    streak++;
  }
  return streak;
}

// Colony-friend microbes. A healthy gut is diverse, so each friend is a distinct
// little species — six variants (round, oval, rod, spiky cocci, antenna, wink)
// in cohesive green/teal tones. `variant` selects the look; it's stable per slot.
function MiniMicrobe({ size = 30, locked, variant = 0 }) {
  if (locked) {
    return (
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Circle cx="20" cy="20" r="15" fill="#dbe7db" stroke="#bcd0bc" strokeWidth="2" strokeDasharray="4 3" />
      </Svg>
    );
  }
  const ink = THEME.ink;
  const v = ((variant % 6) + 6) % 6;
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      {/* Every species shares the same-size face: belly r8.5, eyes r2.3, identical
          smile — only the body shape and colour change, so the colony reads as a
          consistent family. */}
      {v === 0 && (
        <>
          {/* coccus (sphere, Lactococcus) — green, with cilia */}
          <G stroke="#4e944e" strokeWidth={1.8} strokeLinecap="round">
            <Line x1="20" y1="6.5" x2="20" y2="2.5" />
            <Line x1="30" y1="11" x2="33" y2="8" />
            <Line x1="34.5" y1="21" x2="38" y2="21" />
            <Line x1="10" y1="30.5" x2="7" y2="33" />
            <Line x1="5.5" y1="21" x2="2" y2="21" />
          </G>
          <Circle cx="20" cy="21" r="14.5" fill="#5fb06a" />
          <Circle cx="20" cy="22" r="8.5" fill="#c2e8c2" />
          <Circle cx="12.5" cy="13.5" r="1.7" fill="#8fcf8f" />
          <Circle cx="28" cy="14" r="1.4" fill="#8fcf8f" />
          <Circle cx="16.5" cy="19" r="2.3" fill={ink} />
          <Circle cx="23.5" cy="19" r="2.3" fill={ink} />
          <Circle cx="17.3" cy="18.2" r="0.85" fill="#fff" />
          <Circle cx="24.3" cy="18.2" r="0.85" fill="#fff" />
          <Ellipse cx="13" cy="24" rx="2.3" ry="1.5" fill="#f2a8a8" />
          <Ellipse cx="27" cy="24" rx="2.3" ry="1.5" fill="#f2a8a8" />
          <Path d="M16.4 24 Q20 27.4 23.6 24" stroke={ink} strokeWidth={2} fill="none" strokeLinecap="round" />
        </>
      )}
      {v === 1 && (
        <>
          {/* bacillus (rod, Lactobacillus) — amber, with little flagella */}
          <G stroke="#d49a2a" strokeWidth={1.8} strokeLinecap="round">
            <Line x1="4" y1="16" x2="1" y2="13" />
            <Line x1="4" y1="24" x2="1" y2="27" />
            <Line x1="36" y1="16" x2="39" y2="13" />
            <Line x1="36" y1="24" x2="39" y2="27" />
          </G>
          <Rect x="2" y="11" width="36" height="18" rx="9" fill="#f0bd4f" />
          <Circle cx="20" cy="20" r="8.5" fill="#fbe7ad" />
          <Circle cx="9.5" cy="17" r="1.6" fill="#f6d479" />
          <Circle cx="30.5" cy="23" r="1.4" fill="#f6d479" />
          <Circle cx="16.5" cy="17" r="2.3" fill={ink} />
          <Circle cx="23.5" cy="17" r="2.3" fill={ink} />
          <Circle cx="17.3" cy="16.2" r="0.85" fill="#fff" />
          <Circle cx="24.3" cy="16.2" r="0.85" fill="#fff" />
          <Ellipse cx="13" cy="22" rx="2.2" ry="1.4" fill="#ec9a86" />
          <Ellipse cx="27" cy="22" rx="2.2" ry="1.4" fill="#ec9a86" />
          <Path d="M16.4 22 Q20 25.4 23.6 22" stroke={ink} strokeWidth={2} fill="none" strokeLinecap="round" />
        </>
      )}
      {v === 2 && (
        <>
          {/* bifidobacterium (Y-shaped / bifid rod) — lavender */}
          <G stroke="#8b7cd0" strokeWidth={1.8} strokeLinecap="round">
            <Line x1="9" y1="25" x2="5" y2="25" />
            <Line x1="31" y1="25" x2="35" y2="25" />
            <Line x1="11" y1="31" x2="8.5" y2="34" />
            <Line x1="29" y1="31" x2="31.5" y2="34" />
            <Line x1="20" y1="35.5" x2="20" y2="38.5" />
          </G>
          <G stroke="#a99ce6" strokeWidth={9} strokeLinecap="round">
            <Line x1="20" y1="22" x2="11" y2="7" />
            <Line x1="20" y1="22" x2="29" y2="7" />
          </G>
          <Circle cx="14" cy="11" r="1.5" fill="#c4b8f0" />
          <Circle cx="26" cy="11" r="1.5" fill="#c4b8f0" />
          <Circle cx="20" cy="25" r="11" fill="#a99ce6" />
          <Circle cx="20" cy="25" r="8.5" fill="#e0daf8" />
          <Circle cx="16.5" cy="22" r="2.3" fill={ink} />
          <Circle cx="23.5" cy="22" r="2.3" fill={ink} />
          <Circle cx="17.3" cy="21.2" r="0.85" fill="#fff" />
          <Circle cx="24.3" cy="21.2" r="0.85" fill="#fff" />
          <Ellipse cx="13" cy="27" rx="2.3" ry="1.5" fill="#e69ec0" />
          <Ellipse cx="27" cy="27" rx="2.3" ry="1.5" fill="#e69ec0" />
          <Path d="M16.4 27 Q20 30.4 23.6 27" stroke={ink} strokeWidth={2} fill="none" strokeLinecap="round" />
        </>
      )}
      {v === 3 && (
        <>
          {/* streptococcus (chain of cocci) — coral */}
          <G stroke="#d4683f" strokeWidth={1.8} strokeLinecap="round">
            <Line x1="20" y1="9" x2="20" y2="5.5" />
            <Line x1="6" y1="14" x2="3.5" y2="11.5" />
            <Line x1="34" y1="14" x2="36.5" y2="11.5" />
            <Line x1="6" y1="26" x2="3.5" y2="28.5" />
            <Line x1="34" y1="26" x2="36.5" y2="28.5" />
          </G>
          <Circle cx="7" cy="20" r="7" fill="#ef8f6c" />
          <Circle cx="33" cy="20" r="7" fill="#ef8f6c" />
          <Circle cx="7" cy="18" r="1.4" fill="#f6b39a" />
          <Circle cx="33" cy="18" r="1.4" fill="#f6b39a" />
          <Circle cx="20" cy="20" r="10.5" fill="#ef8f6c" />
          <Circle cx="20" cy="21" r="8.5" fill="#fbd8c6" />
          <Circle cx="16.5" cy="18" r="2.3" fill={ink} />
          <Circle cx="23.5" cy="18" r="2.3" fill={ink} />
          <Circle cx="17.3" cy="17.2" r="0.85" fill="#fff" />
          <Circle cx="24.3" cy="17.2" r="0.85" fill="#fff" />
          <Ellipse cx="14" cy="23" rx="2.2" ry="1.4" fill="#e98a6f" />
          <Ellipse cx="26" cy="23" rx="2.2" ry="1.4" fill="#e98a6f" />
          <Path d="M16.4 23 Q20 26.4 23.6 23" stroke={ink} strokeWidth={2} fill="none" strokeLinecap="round" />
        </>
      )}
      {v === 4 && (
        <>
          {/* budding yeast (Saccharomyces boulardii) — blue */}
          <G stroke="#3f88c0" strokeWidth={1.8} strokeLinecap="round">
            <Line x1="5" y1="23" x2="2" y2="23" />
            <Line x1="9" y1="33" x2="6.5" y2="35.5" />
            <Line x1="18" y1="36" x2="18" y2="39" />
            <Line x1="27" y1="33" x2="29.5" y2="35.5" />
          </G>
          <Circle cx="31" cy="11" r="6" fill="#5fa8e0" />
          <Circle cx="31" cy="9.5" r="1.3" fill="#9fcdf0" />
          <Circle cx="18" cy="23" r="13" fill="#5fa8e0" />
          <Circle cx="18" cy="23" r="8.5" fill="#cbe6f8" />
          <Circle cx="9.5" cy="17" r="1.7" fill="#9fcdf0" />
          <Circle cx="14.5" cy="20" r="2.3" fill={ink} />
          <Circle cx="21.5" cy="20" r="2.3" fill={ink} />
          <Circle cx="15.3" cy="19.2" r="0.85" fill="#fff" />
          <Circle cx="22.3" cy="19.2" r="0.85" fill="#fff" />
          <Ellipse cx="11" cy="25" rx="2.2" ry="1.4" fill="#f2a8a8" />
          <Ellipse cx="25" cy="25" rx="2.2" ry="1.4" fill="#f2a8a8" />
          <Path d="M14.4 25 Q18 28.4 21.6 25" stroke={ink} strokeWidth={2} fill="none" strokeLinecap="round" />
        </>
      )}
      {v === 5 && (
        <>
          {/* diplococcus (pair) — pink, one shared face */}
          <G stroke="#d4689a" strokeWidth={1.8} strokeLinecap="round">
            <Line x1="3.5" y1="21" x2="0.5" y2="21" />
            <Line x1="36.5" y1="21" x2="39.5" y2="21" />
            <Line x1="13" y1="11.5" x2="11" y2="8.5" />
            <Line x1="27" y1="11.5" x2="29" y2="8.5" />
            <Line x1="20" y1="30.5" x2="20" y2="33.5" />
          </G>
          <Circle cx="13" cy="21" r="9.5" fill="#ec84ac" />
          <Circle cx="27" cy="21" r="9.5" fill="#ec84ac" />
          <Circle cx="9" cy="15" r="1.5" fill="#f4a8c6" />
          <Circle cx="31" cy="15" r="1.5" fill="#f4a8c6" />
          <Circle cx="20" cy="22" r="8.5" fill="#fad2e2" />
          <Circle cx="16.5" cy="19" r="2.3" fill={ink} />
          <Circle cx="23.5" cy="19" r="2.3" fill={ink} />
          <Circle cx="17.3" cy="18.2" r="0.85" fill="#fff" />
          <Circle cx="24.3" cy="18.2" r="0.85" fill="#fff" />
          <Ellipse cx="13" cy="24" rx="2.2" ry="1.4" fill="#e070a0" />
          <Ellipse cx="27" cy="24" rx="2.2" ry="1.4" fill="#e070a0" />
          <Path d="M16.4 24 Q20 27.4 23.6 24" stroke={ink} strokeWidth={2} fill="none" strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}

// Colony display: rather than render every member (which duplicates the 6
// species), we group by species and show each one once — bigger — with a "×N"
// multiplier for how many of that microbe you have. One faded silhouette teases
// the next species still to unlock.
function ColonyCluster({ size = 46, colonySize = 0, centered = false }) {
  const counts = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < colonySize; i++) counts[i % 6]++;
  const items = [];
  counts.forEach((c, s) => { if (c > 0) items.push({ species: s, count: c }); });
  const showNext = colonySize > 0 && items.length < 6;
  const wrap = { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Math.round(size * 0.32), justifyContent: centered ? 'center' : 'flex-start' };

  if (colonySize === 0) {
    return (
      <View style={wrap}>
        {[0, 1, 2].map(sp => <MiniMicrobe key={sp} size={size} locked variant={sp} />)}
      </View>
    );
  }
  return (
    <View style={wrap}>
      {items.map(it => (
        <View key={it.species} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <MiniMicrobe size={size} variant={it.species} />
          {it.count > 1 && (
            <View style={{ position: 'absolute', right: -4, bottom: -3, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dfeadf', borderRadius: 9, minWidth: 19, paddingHorizontal: 4, paddingVertical: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 10, fontWeight: '700', color: THEME.primaryDark }}>×{it.count}</Text>
            </View>
          )}
        </View>
      ))}
      {showNext && <MiniMicrobe size={size} locked variant={colonySize % 6} />}
    </View>
  );
}

// ─── PLAN SCENE ILLUSTRATIONS ────────────────────────────────────────────
// Two wide story illustrations for the My Plan phases, in the same sage/microbe
// visual language. Width-driven; height keeps the 220×150 aspect.

// Elimination: Flora cheerfully, politely waving off a glass of milk — "we're
// taking a break from this one for now", not "this food is bad".
function FloraPause({ width = 190 }) {
  return (
    <Svg width={width} height={width * 150 / 220} viewBox="0 0 220 150">
      {/* milk glass */}
      <Path d="M44 64 L74 64 L70 120 L48 120 Z" fill="#eef4fb" stroke="#c8d4de" strokeWidth="2" strokeLinejoin="round" />
      <Path d="M46 84 L72 84 L70 120 L48 120 Z" fill="#ffffff" />
      <Ellipse cx="59" cy="64" rx="15" ry="4.5" fill="#ffffff" stroke="#c8d4de" strokeWidth="2" />
      {/* body + cilia — wavy fringe on the exposed (right) side; arm covers the left */}
      <G stroke={THEME.primary} strokeWidth="3" strokeLinecap="round" fill="none">
        {ciliaFringe(44, 13, 148, 82, 11, 3, [-100, 130]).map((d, i) => <Path key={i} d={d} />)}
      </G>
      <Circle cx="148" cy="82" r="44" fill="#6fa86f" />
      <Circle cx="148" cy="85" r="30" fill="#bfe0bf" />
      {/* arm + open-palm "no thanks" hand toward the glass */}
      <Line x1="114" y1="90" x2="97" y2="82" stroke="#6fa86f" strokeWidth="9" strokeLinecap="round" />
      <Circle cx="91" cy="79" r="11" fill="#7ab47a" />
      <G stroke="#4e944e" strokeWidth="2" strokeLinecap="round">
        <Line x1="87" y1="72" x2="87" y2="68" />
        <Line x1="92" y1="71" x2="93" y2="67" />
        <Line x1="96" y1="73" x2="98" y2="70" />
      </G>
      {/* face */}
      <Circle cx="138" cy="80" r="5.5" fill={THEME.ink} />
      <Circle cx="158" cy="80" r="5.5" fill={THEME.ink} />
      <Circle cx="139.5" cy="78" r="1.8" fill="#fff" />
      <Circle cx="159.5" cy="78" r="1.8" fill="#fff" />
      <Ellipse cx="131" cy="90" rx="4.5" ry="3" fill="#f2b6b6" />
      <Ellipse cx="165" cy="90" rx="4.5" ry="3" fill="#f2b6b6" />
      <Path d="M140 90 Q148 99 156 90" stroke={THEME.ink} strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* pause badge */}
      <Circle cx="186" cy="46" r="13" fill="#ffffff" stroke="#cfe0cf" strokeWidth="1.5" />
      <Rect x="181" y="40" width="3.4" height="12" rx="1.7" fill={THEME.primary} />
      <Rect x="187.2" y="40" width="3.4" height="12" rx="1.7" fill={THEME.primary} />
    </Svg>
  );
}

// Elimination variant B: Flora presenting a clean plate of safe low-FODMAP
// foods — positive framing ("here's what you can eat") vs the original "no thanks".
function FloraPauseB({ width = 190 }) {
  return (
    <Svg width={width} height={width * 150 / 220} viewBox="0 0 220 150">
      {/* plate base + shadow */}
      <Ellipse cx="68" cy="120" rx="36" ry="5.5" fill="#d8e4d8" />
      <Circle cx="68" cy="99" r="34" fill="#f0f7f0" stroke="#cfe0cf" strokeWidth="2" />
      <Circle cx="68" cy="99" r="26" fill="#ffffff" />
      {/* safe foods on plate: carrot, rice grain, cucumber slice */}
      <Ellipse cx="61" cy="96" rx="7" ry="3.5" fill="#f4a055" transform="rotate(-20 61 96)" />
      <Circle cx="76" cy="93" r="3.8" fill="#d0e8c8" stroke="#8aba8a" strokeWidth="1.2" />
      <Ellipse cx="68" cy="104" rx="5" ry="3" fill="#a8d4a8" />
      {/* small sparkle star above plate */}
      <Path d="M68 60 l2 5.5 5.5 2 -5.5 2 -2 5.5 -2 -5.5 -5.5 -2 5.5 -2 Z" fill="#f4c84a" />
      {/* safe badge */}
      <Circle cx="100" cy="74" r="11" fill="#e8f5e8" stroke="#a8d4a8" strokeWidth="1.5" />
      <Path d="M95 74 l3.5 3.5 6.5 -7" stroke="#2d6a2d" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Flora body + cilia — wavy fringe on the exposed (right) side */}
      <G stroke={THEME.primary} strokeWidth="3" strokeLinecap="round" fill="none">
        {ciliaFringe(42, 13, 158, 80, 11, 3, [-100, 130]).map((d, i) => <Path key={i} d={d} />)}
      </G>
      <Circle cx="158" cy="80" r="42" fill="#6fa86f" />
      <Circle cx="158" cy="83" r="28" fill="#bfe0bf" />
      {/* arm presenting toward the plate */}
      <Line x1="126" y1="86" x2="108" y2="96" stroke="#6fa86f" strokeWidth="9" strokeLinecap="round" />
      <Circle cx="102" cy="99" r="10" fill="#7ab47a" />
      {/* face: happy, proud */}
      <Circle cx="148" cy="78" r="5.5" fill={THEME.ink} />
      <Circle cx="168" cy="78" r="5.5" fill={THEME.ink} />
      <Circle cx="149.5" cy="76" r="1.8" fill="#fff" />
      <Circle cx="169.5" cy="76" r="1.8" fill="#fff" />
      <Ellipse cx="141" cy="88" rx="4" ry="2.8" fill="#f2b6b6" />
      <Ellipse cx="175" cy="88" rx="4" ry="2.8" fill="#f2b6b6" />
      <Path d="M150 88 Q158 97 166 88" stroke={THEME.ink} strokeWidth="3" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

// Elimination variant C: Flora in a calm, centred pose with a small 6-week
// progress row below — emphasises the structured, time-boxed nature of the phase.
function FloraPauseC({ width = 190 }) {
  const weeks = [0, 1, 2, 3, 4, 5];
  return (
    <Svg width={width} height={width * 150 / 220} viewBox="0 0 220 150">
      {/* week tracker row */}
      {weeks.map((i) => {
        const cx = 44 + i * 27;
        const filled = i < 2;
        return (
          <G key={i}>
            <Circle cx={cx} cy={125} r="10" fill={filled ? THEME.primary : '#e0e8e0'} />
            {filled
              ? <Path d={`M${cx - 4} 125 l3.5 3.5 6 -7`} stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              : <Text style={{ fontSize: 9 }}>{i + 1}</Text>}
            {!filled && <SvgText x={cx} y={129} textAnchor="middle" fontSize="9" fill="#647264" fontWeight="600">{i + 1}</SvgText>}
            {i < 5 && <Line x1={cx + 10} y1={125} x2={cx + 17} y2={125} stroke="#d0dcd0" strokeWidth="1.5" />}
          </G>
        );
      })}
      <SvgText x="110" y="112" textAnchor="middle" fontSize="9.5" fill={THEME.textMuted} fontWeight="700" letterSpacing="1">6 WEEKS</SvgText>
      {/* Flora body + cilia — wavy fringe over the top and sides (tracker text below) */}
      <G stroke={THEME.primary} strokeWidth="3" strokeLinecap="round" fill="none">
        {ciliaFringe(42, 15, 110, 68, 11, 3.2, [130, 410]).map((d, i) => <Path key={i} d={d} />)}
      </G>
      <Circle cx="110" cy="68" r="42" fill="#6fa86f" />
      <Circle cx="110" cy="71" r="28" fill="#bfe0bf" />
      {/* calm closed-eye smile face */}
      <Path d="M94 61 Q102 57 109 61" stroke={THEME.ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <Path d="M111 61 Q118 57 126 61" stroke={THEME.ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <Ellipse cx="102" cy="72" rx="5" ry="3" fill="#f2b6b6" />
      <Ellipse cx="118" cy="72" rx="5" ry="3" fill="#f2b6b6" />
      <Path d="M102 72 Q110 80 118 72" stroke={THEME.ink} strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* small leaf accent top */}
      <Path d="M110 15 Q116 8 122 12 Q116 18 110 15Z" fill="#8ac48a" />
    </Svg>
  );
}

// Reintroduction: Flora peeking over three covered dishes (cloches), curious
// and excited — "let's try one food at a time and see how your body responds".
function FloraExplore({ width = 190 }) {
  const cloche = (cx, tint) => (
    <G key={cx}>
      <Ellipse cx={cx} cy={132} rx={26} ry={5} fill="#d8e0d8" />
      <Path d={`M${cx - 23} 130 A 23 23 0 0 1 ${cx + 23} 130 Z`} fill={tint} stroke="#c4cdd6" strokeWidth="2" />
      <Circle cx={cx} cy={106} r="3.6" fill="#c4cdd6" />
    </G>
  );
  return (
    <Svg width={width} height={width * 150 / 220} viewBox="0 0 220 150">
      {/* curiosity sparkles */}
      <Path d="M68 26 l2.4 6 6 2.4 -6 2.4 -2.4 6 -2.4 -6 -6 -2.4 6 -2.4 Z" fill="#f4c84a" />
      <Path d="M150 34 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 Z" fill="#f4c84a" />
      {/* cloches */}
      {cloche(54, '#e6ecf0')}
      {cloche(110, '#ece4f4')}
      {cloche(166, '#e2efe2')}
      {/* body + cilia — wavy fringe over the top (head peeks over the dishes) */}
      <G stroke={THEME.primary} strokeWidth="3" strokeLinecap="round" fill="none">
        {ciliaFringe(38, 11, 110, 58, 10, 2.8, [-190, 10]).map((d, i) => <Path key={i} d={d} />)}
      </G>
      <Circle cx="110" cy="58" r="38" fill="#6fa86f" />
      <Circle cx="110" cy="61" r="25" fill="#bfe0bf" />
      {/* curious face looking down at the dishes */}
      <Path d="M91 47 Q99 43 106 47" stroke={THEME.ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <Path d="M114 47 Q121 43 129 47" stroke={THEME.ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <Circle cx="100" cy="59" r="5.5" fill={THEME.ink} />
      <Circle cx="120" cy="59" r="5.5" fill={THEME.ink} />
      <Circle cx="101.5" cy="61" r="2" fill="#fff" />
      <Circle cx="121.5" cy="61" r="2" fill="#fff" />
      <Ellipse cx="93" cy="68" rx="4" ry="2.6" fill="#f2b6b6" />
      <Ellipse cx="127" cy="68" rx="4" ry="2.6" fill="#f2b6b6" />
      <Path d="M102 68 Q110 74 118 68" stroke={THEME.ink} strokeWidth="3" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

// Empty-state hero: Flora lovingly tending a little potted sprout — caring for
// her own gut health. A heart floats above. Same sage/microbe visual language.
function FloraCare({ width = 210, blink = false, showHeart = true }) {
  return (
    <Svg width={width} height={width * 150 / 220} viewBox="0 0 220 150">
      {/* heart (static; the animated version is overlaid in AnimatedFloraCare) */}
      {showHeart && <Path d="M110 13 C108 7 99 7 99 15 C99 21 110 27 110 27 C110 27 121 21 121 15 C121 7 112 7 110 13 Z" fill="#f2a8a8" />}
      {/* cilia — wavy fringe on the upper sides (heart sits at top-centre, arms below) */}
      <G stroke={THEME.primary} strokeWidth="3" strokeLinecap="round" fill="none">
        {ciliaFringe(40, 5, 110, 66, 10, 2.8, [-168, -108]).map((d, i) => <Path key={`l${i}`} d={d} />)}
        {ciliaFringe(40, 5, 110, 66, 10, 2.8, [-72, -12]).map((d, i) => <Path key={`r${i}`} d={d} />)}
      </G>
      {/* body */}
      <Circle cx="110" cy="66" r="40" fill="#6fa86f" />
      <Circle cx="110" cy="69" r="27" fill="#bfe0bf" />
      {/* face */}
      {blink ? (
        <>
          <Path d="M95 64 Q100 68 105 64" stroke={THEME.ink} strokeWidth="3" fill="none" strokeLinecap="round" />
          <Path d="M115 64 Q120 68 125 64" stroke={THEME.ink} strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <Circle cx="100" cy="64" r="5.5" fill={THEME.ink} />
          <Circle cx="120" cy="64" r="5.5" fill={THEME.ink} />
          <Circle cx="101.5" cy="62" r="1.9" fill="#fff" />
          <Circle cx="121.5" cy="62" r="1.9" fill="#fff" />
        </>
      )}
      <Ellipse cx="92" cy="74" rx="4.5" ry="3" fill="#f2b6b6" />
      <Ellipse cx="128" cy="74" rx="4.5" ry="3" fill="#f2b6b6" />
      <Path d="M102 74 Q110 81 118 74" stroke={THEME.ink} strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* arms cradling the pot */}
      <Line x1="86" y1="88" x2="98" y2="106" stroke="#6fa86f" strokeWidth="8" strokeLinecap="round" />
      <Line x1="134" y1="88" x2="122" y2="106" stroke="#6fa86f" strokeWidth="8" strokeLinecap="round" />
      <Circle cx="99" cy="108" r="7" fill="#7ab47a" />
      <Circle cx="121" cy="108" r="7" fill="#7ab47a" />
      {/* potted sprout in front */}
      <Path d="M96 117 L124 117 L120 139 L100 139 Z" fill="#d8a878" stroke="#c89868" strokeWidth="1.5" strokeLinejoin="round" />
      <Rect x="93" y="111" width="34" height="8" rx="2.5" fill="#c89868" />
      <Line x1="110" y1="111" x2="110" y2="96" stroke="#4e7d4e" strokeWidth="3" strokeLinecap="round" />
      <Ellipse cx="102" cy="98" rx="7" ry="4" fill="#6fa86f" transform="rotate(-32 102 98)" />
      <Ellipse cx="118" cy="98" rx="7" ry="4" fill="#4e7d4e" transform="rotate(32 118 98)" />
      {/* sparkle */}
      <Path d="M150 96 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 Z" fill="#f4c84a" />
    </Svg>
  );
}

// FloraCare stays grounded (it's a vase + sprout). The heart is overlaid as its
// own RN view so it pulses about its centre (a lub-dub beat), and she blinks.
function AnimatedFloraCare({ width = 216 }) {
  const height = width * 150 / 220;
  const heart = useRef(new Animated.Value(0)).current;
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(heart, { toValue: 1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(heart, { toValue: 0, duration: 190, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(heart, { toValue: 0.55, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(heart, { toValue: 0, duration: 170, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.delay(1300),
    ]));
    loop.start();
    let bt, ot;
    const schedule = () => { bt = setTimeout(() => { setBlink(true); ot = setTimeout(() => { setBlink(false); schedule(); }, 140); }, 2600 + Math.random() * 2600); };
    schedule();
    return () => { loop.stop(); clearTimeout(bt); clearTimeout(ot); };
  }, []);
  const scale = heart.interpolate({ inputRange: [0, 1], outputRange: [1, 1.25] });
  // Overlay box generously contains the heart (its lobes reach up to ~y6); the
  // box maps 1:1 onto the illustration so the heart sits exactly where it would.
  const k = width / 220;
  const vbX = 95, vbY = 4, vbW = 30, vbH = 26;
  return (
    <View style={{ width, height }}>
      <FloraCare width={width} blink={blink} showHeart={false} />
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: vbX * k, top: vbY * k, width: vbW * k, height: vbH * k, transform: [{ scale }] }}>
        <Svg width={vbW * k} height={vbH * k} viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}>
          <Path d="M110 13 C108 7 99 7 99 15 C99 21 110 27 110 27 C110 27 121 21 121 15 C121 7 112 7 110 13 Z" fill="#f2a8a8" />
        </Svg>
      </Animated.View>
    </View>
  );
}

// Animated cooking Flora for the recipes tile: a chef-hatted microbe stirring
// a pot, with two steam puffs rising on a gentle loop. Self-contained animation.
function FloraCooking({ size = 60 }) {
  const s1 = useRef(new Animated.Value(0)).current;
  const s2 = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const mk = (v, delay) => Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration: 1700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    const l1 = mk(s1, 0), l2 = mk(s2, 850);
    l1.start(); l2.start();
    return () => { l1.stop(); l2.stop(); };
  }, []);
  const puff = (v, left, w) => ({
    position: 'absolute', left, bottom: size * 0.34, width: w, height: w, borderRadius: w / 2, backgroundColor: '#ffffff',
    opacity: v.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 0.85, 0.4, 0] }),
    transform: [
      { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.34] }) },
      { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.3] }) },
    ],
  });
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* chef hat */}
        <Circle cx="40" cy="21" r="9" fill="#ffffff" />
        <Circle cx="60" cy="21" r="9" fill="#ffffff" />
        <Circle cx="50" cy="15" r="10" fill="#ffffff" />
        <Rect x="36" y="25" width="28" height="9" rx="3" fill="#ffffff" stroke="#e6ece6" strokeWidth="1" />
        {/* body */}
        <Circle cx="50" cy="55" r="25" fill="#6fa86f" />
        <Circle cx="50" cy="57" r="16" fill="#bfe0bf" />
        {/* face */}
        <Circle cx="43" cy="53" r="3.6" fill={THEME.ink} />
        <Circle cx="57" cy="53" r="3.6" fill={THEME.ink} />
        <Circle cx="44" cy="51.6" r="1.2" fill="#fff" />
        <Circle cx="58" cy="51.6" r="1.2" fill="#fff" />
        <Ellipse cx="38" cy="60" rx="3" ry="2" fill="#f2b6b6" />
        <Ellipse cx="62" cy="60" rx="3" ry="2" fill="#f2b6b6" />
        <Path d="M44 60 Q50 65 56 60" stroke={THEME.ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        {/* stirring arm + spoon */}
        <Line x1="62" y1="66" x2="71" y2="80" stroke="#6fa86f" strokeWidth="6" strokeLinecap="round" />
        <Line x1="71" y1="80" x2="65" y2="87" stroke="#caa46a" strokeWidth="3.4" strokeLinecap="round" />
        {/* pot */}
        <Rect x="30" y="80" width="40" height="14" rx="4" fill="#7a8a7a" />
        <Rect x="27" y="77" width="46" height="5" rx="2.5" fill="#647264" />
      </Svg>
      <Animated.View style={puff(s1, size * 0.42, 6)} />
      <Animated.View style={puff(s2, size * 0.54, 5)} />
    </View>
  );
}

// Flora presenting an open cookbook, with a premium sparkle — for the
// "unlock all recipes" tile. Distinct from the cooking/cloche illustrations.
function FloraCookbook({ size = 70 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* cilia — wavy fringe across the top (arms/book below) */}
      <G stroke={THEME.primary} strokeWidth="2.6" strokeLinecap="round" fill="none">
        {ciliaFringe(24, 9, 50, 46, 8, 2.2, [-150, -30]).map((d, i) => <Path key={i} d={d} />)}
      </G>
      {/* body */}
      <Circle cx="50" cy="46" r="24" fill="#6fa86f" />
      <Circle cx="50" cy="48" r="15" fill="#bfe0bf" />
      {/* face */}
      <Circle cx="43" cy="44" r="3.4" fill={THEME.ink} />
      <Circle cx="57" cy="44" r="3.4" fill={THEME.ink} />
      <Circle cx="44" cy="42.6" r="1.2" fill="#fff" />
      <Circle cx="58" cy="42.6" r="1.2" fill="#fff" />
      <Ellipse cx="38" cy="51" rx="3" ry="2" fill="#f2b6b6" />
      <Ellipse cx="62" cy="51" rx="3" ry="2" fill="#f2b6b6" />
      <Path d="M44 51 Q50 56 56 51" stroke={THEME.ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* arms holding the book */}
      <Line x1="32" y1="58" x2="34" y2="73" stroke="#6fa86f" strokeWidth="6" strokeLinecap="round" />
      <Line x1="68" y1="58" x2="66" y2="73" stroke="#6fa86f" strokeWidth="6" strokeLinecap="round" />
      {/* book cover */}
      <Path d="M50 72 L24 76 L26 92 L50 88 Z" fill="#4e7d4e" />
      <Path d="M50 72 L76 76 L74 92 L50 88 Z" fill="#4e944e" />
      {/* pages */}
      <Path d="M50 74 L29 77.5 L30.5 89 L50 85.5 Z" fill="#ffffff" />
      <Path d="M50 74 L71 77.5 L69.5 89 L50 85.5 Z" fill="#f4f7f4" />
      {/* text lines + spine */}
      <G stroke="#cfd8cf" strokeWidth="1.4" strokeLinecap="round">
        <Line x1="34" y1="80" x2="46" y2="78.5" />
        <Line x1="34" y1="83.5" x2="46" y2="82" />
        <Line x1="54" y1="78.5" x2="66" y2="80" />
        <Line x1="54" y1="82" x2="66" y2="83.5" />
        <Line x1="50" y1="74" x2="50" y2="85.5" />
      </G>
      {/* premium sparkle */}
      <Path d="M78 30 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" fill="#f4c84a" />
    </Svg>
  );
}

// Flora the guide: pointing at a bright idea (lightbulb) — for the GutGuide
// intro. Signals friendly, plain-English knowledge.
function FloraGuide({ size = 64 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* idea rays */}
      <G stroke="#f4c84a" strokeWidth="2.4" strokeLinecap="round">
        <Line x1="78" y1="9" x2="78" y2="4" />
        <Line x1="90" y1="15" x2="94" y2="12" />
        <Line x1="66" y1="15" x2="62" y2="12" />
        <Line x1="92" y1="27" x2="97" y2="27" />
      </G>
      {/* lightbulb */}
      <Circle cx="78" cy="25" r="10" fill="#ffe08a" stroke="#e8b84a" strokeWidth="1.5" />
      <Rect x="74" y="33" width="8" height="5" rx="1.5" fill="#cbb06a" />
      <Path d="M75 25 L78 29 L81 22" stroke="#caa43a" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* cilia — wavy fringe on the left (arm points to the bulb on the right) */}
      <G stroke={THEME.primary} strokeWidth="2.6" strokeLinecap="round" fill="none">
        {ciliaFringe(26, 7, 48, 56, 8, 2.4, [-145, -215]).map((d, i) => <Path key={i} d={d} />)}
      </G>
      {/* body */}
      <Circle cx="48" cy="56" r="26" fill="#6fa86f" />
      <Circle cx="48" cy="58" r="16" fill="#bfe0bf" />
      {/* raised arm pointing to the bulb */}
      <Line x1="64" y1="44" x2="71" y2="34" stroke="#6fa86f" strokeWidth="6" strokeLinecap="round" />
      {/* face */}
      <Circle cx="41" cy="54" r="3.6" fill={THEME.ink} />
      <Circle cx="55" cy="54" r="3.6" fill={THEME.ink} />
      <Circle cx="42" cy="52.6" r="1.2" fill="#fff" />
      <Circle cx="56" cy="52.6" r="1.2" fill="#fff" />
      <Ellipse cx="36" cy="61" rx="3" ry="2" fill="#f2b6b6" />
      <Ellipse cx="60" cy="61" rx="3" ry="2" fill="#f2b6b6" />
      <Path d="M42 61 Q48 66 54 61" stroke={THEME.ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

// Flora gently bobbing up and down on a loop — a lightweight hero animation
// for screens like the paywall. Defaults to her thriving form (sparkles + crown).
function FloatingFlora({ size = 120, form = 'thriving', mood = 'good' }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(y, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  const translateY = y.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  return (
    <Animated.View style={{ transform: [{ translateY }] }}>
      <Flora size={size} form={form} mood={mood} />
    </Animated.View>
  );
}

// A premium hero: a soft golden glow halo behind a floating Flora, with a few
// sparkles twinkling around her. Used on the paywall to feel aspirational.
function PremiumHero() {
  const W = 220, H = 190;
  const tw = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  useEffect(() => {
    const loops = tw.map((v, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * 450),
      Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ])));
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);
  const sparkle = (v) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.1] }) }],
  });
  const stars = [
    { left: 34, top: 36, size: 20 },
    { left: 168, top: 50, size: 15 },
    { left: 44, top: 128, size: 14 },
    { left: 172, top: 122, size: 18 },
  ];
  return (
    <View style={{ width: W, height: H, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
        <Defs>
          <RadialGradient id="premiumGlow" cx="50%" cy="48%" r="50%">
            <Stop offset="0%" stopColor="#f4c84a" stopOpacity="0.34" />
            <Stop offset="55%" stopColor="#f4c84a" stopOpacity="0.12" />
            <Stop offset="100%" stopColor="#f4c84a" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={W / 2} cy={H * 0.46} r={W / 2} fill="url(#premiumGlow)" />
      </Svg>
      <FloatingFlora size={128} form="thriving" mood="good" />
      {stars.map((st, i) => (
        <Animated.Text key={i} style={[{ position: 'absolute', left: st.left, top: st.top, fontSize: st.size }, sparkle(tw[i])]}>✨</Animated.Text>
      ))}
    </View>
  );
}

// Maps a 0–100 gut score to a Flora mood + a friendly status message.
function moodFromScore(score, symptomFreeDays, t) {
  if (!t) {
    // fallback for callers that haven't threaded t yet
    if (score == null) return { mood: 'soso', title: "Let's see how today goes", sub: 'Log a meal or symptom and Flora will react.' };
    if (score >= 75) return { mood: 'good', title: 'Flora feels calm today', sub: symptomFreeDays > 0 ? `No flare-ups in ${symptomFreeDays} day${symptomFreeDays === 1 ? '' : 's'}. Keep it steady.` : 'Your gut is having a good day.' };
    if (score >= 50) return { mood: 'soso', title: 'A so-so day', sub: 'Mixed signals today — keep logging to spot the cause.' };
    return { mood: 'bad', title: 'Flora is feeling rough', sub: 'A harder gut day. Be gentle with yourself.' };
  }
  if (score == null) return { mood: 'soso', title: t('mood_null_title'), sub: t('mood_null_sub') };
  if (score >= 75) return { mood: 'good', title: t('mood_good_title'), sub: symptomFreeDays > 0 ? t('mood_good_sub_streak', { n: symptomFreeDays, unit: symptomFreeDays === 1 ? t('home_day') : t('home_days') }) : t('mood_good_sub') };
  if (score >= 50) return { mood: 'soso', title: t('mood_soso_title'), sub: t('mood_soso_sub') };
  return { mood: 'bad', title: t('mood_bad_title'), sub: t('mood_bad_sub') };
}

// ─── SCORE RING ──────────────────────────────────────────────────────────
// Google-Fit-style progress ring. Draws a value (0–100) as a stroked arc and
// overlays a centered number + label (RN Text, since SVG <Text> collides with
// the imported react-native Text). Pure presentational; caller computes value.
function ScoreRing({ value = 0, size = 92, stroke = 8, color = THEME.primary, centerValue, centerLabel }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = c * (1 - clamped / 100);
  const cx = size / 2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: 'absolute' }}>
        <Circle cx={cx} cy={cx} r={r} fill="none" stroke={THEME.cardBorder} strokeWidth={stroke} />
        <Circle
          cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          transform={`rotate(-90 ${cx} ${cx})`}
        />
      </Svg>
      {centerValue != null && (
        <Text style={{ fontSize: size * 0.26, fontWeight: '700', color: THEME.ink }}>{centerValue}</Text>
      )}
      {centerLabel != null && (
        <Text numberOfLines={2} style={{ fontSize: size * 0.1, lineHeight: size * 0.12, color: THEME.textMuted, marginTop: 2, textAlign: 'center', width: size * 0.78 }}>{centerLabel}</Text>
      )}
    </View>
  );
}

// Honest guidance bands. GutBloom's food guidance is based on established low-FODMAP
// principles, not lab-tested percentages — so we show a likelihood band, not a fake
// precise number. The internal popTrigger value is kept only for sensible sort order.
function triggerBand(popTrigger, t) {
  const tr = t || ((k) => STRINGS.en[k] || k);
  if (popTrigger >= 60) return { label: tr('band_common'), short: tr('band_common_s'), color: '#c85050' };
  if (popTrigger >= 30) return { label: tr('band_sometimes'), short: tr('band_sometimes_s'), color: '#a86518' };
  return { label: tr('band_rarely'), short: tr('band_rarely_s'), color: '#4e7d4e' };
}


// GutGuide: 50 common questions with honest, evidence-informed answers.
// topics: basics, elimination, reintro, eatingout, lifestyle, longterm
const GUT_GUIDE_TOPICS = [
  { id: 'all', label: 'All' },
  { id: 'basics', label: 'FODMAP basics' },
  { id: 'elimination', label: 'Elimination' },
  { id: 'reintro', label: 'Reintroduction' },
  { id: 'eatingout', label: 'Eating out' },
  { id: 'lifestyle', label: 'Symptoms & life' },
  { id: 'longterm', label: 'Long-term' },
];

const GUT_GUIDE = [
  { id: 'g1', topic: 'basics', q: 'What does FODMAP actually stand for?', a: 'Fermentable Oligosaccharides, Disaccharides, Monosaccharides And Polyols. They are types of short-chain carbohydrates that are poorly absorbed in the small intestine. In sensitive guts they draw in water and get fermented by bacteria, producing gas — which leads to bloating, pain and changes in bowel habits.' },
  { id: 'g2', topic: 'basics', q: 'Is the low-FODMAP diet a forever diet?', a: 'No — and this is important. It is a short-term diagnostic tool, not a lifestyle. The strict phase lasts only 2-6 weeks. The whole point is to then reintroduce foods and end up with the most varied diet you can tolerate. Staying strict long-term can harm your gut bacteria and risks nutritional gaps.' },
  { id: 'g3', topic: 'basics', q: 'Is low-FODMAP the same as gluten-free?', a: 'No. Gluten is a protein; FODMAPs are carbohydrates. Wheat is high-FODMAP because of fructans, not gluten. Many people on low-FODMAP can eat spelt sourdough, which contains gluten. Unless you have celiac disease, you are avoiding fructans, not gluten itself.' },
  { id: 'g4', topic: 'basics', q: 'Will low-FODMAP cure my IBS?', a: 'It does not cure IBS — there is no cure. But for roughly 60-85% of people with IBS, identifying and managing trigger foods gives meaningful, lasting symptom relief. It is a management tool, and a very effective one for most.' },
  { id: 'g5', topic: 'basics', q: 'Should I do this without a doctor?', a: 'Ideally no. You should have an IBS diagnosis first, because the same symptoms can come from celiac disease, IBD or other conditions that need different treatment. A FODMAP-trained dietitian also dramatically improves success and protects against nutrient gaps. This app supports the journey — it does not replace that diagnosis.' },
  { id: 'g6', topic: 'basics', q: 'What are the main FODMAP groups?', a: 'Six: fructans (wheat, onion, garlic), GOS (legumes, some nuts), lactose (dairy), excess fructose (honey, apple, mango), sorbitol and mannitol (the two polyols, found in stone fruit and mushrooms). You can react to some and not others — that is what reintroduction figures out.' },
  { id: 'g7', topic: 'basics', q: 'Why does portion size matter so much?', a: 'FODMAPs stack. A food can be low-FODMAP in a small serving and high in a large one, because the FODMAP load crosses your threshold. This is why the app shows gram thresholds rather than a simple yes/no — half a portion may be fine when a full one is not.' },
  { id: 'g8', topic: 'basics', q: 'What is FODMAP stacking?', a: 'Eating several moderate-FODMAP foods in one meal so their combined load becomes high — even though no single food was. A moderate fruit, a moderate grain and a moderate vegetable together can tip you over. The app flags meals where this is happening.' },
  { id: 'g9', topic: 'basics', q: 'Can I drink alcohol on low-FODMAP?', a: 'Some options are lower-FODMAP: wine, beer in modest amounts, gin and vodka. Rum and dessert wines are riskier. But alcohol is a gut irritant in its own right regardless of FODMAPs, so it can trigger symptoms even when technically low-FODMAP.' },
  { id: 'g10', topic: 'basics', q: 'Is coffee allowed?', a: 'Black coffee is low-FODMAP. But caffeine stimulates the gut and can trigger symptoms on its own, and a large milky coffee adds lactose. If coffee seems to bother you, that is usually the caffeine, not a FODMAP.' },
  { id: 'g11', topic: 'elimination', q: 'How long should the elimination phase last?', a: 'Two to six weeks. Most people know within 2-4 weeks whether FODMAPs are involved. Do not go longer than six weeks — it is restrictive, it is hard on your gut microbiome, and if symptoms have not improved by then, FODMAPs may not be your main issue.' },
  { id: 'g12', topic: 'elimination', q: 'What if my symptoms do not improve during elimination?', a: 'If you have done a careful 4-6 weeks with no improvement, FODMAPs may not be your trigger. That is useful information. Other paths worth discussing with a doctor: stress and the gut-brain axis, gut-directed hypnotherapy, medications, or re-checking the original diagnosis.' },
  { id: 'g13', topic: 'elimination', q: 'I accidentally ate something high-FODMAP. Did I ruin it?', a: 'No. One slip does not reset the clock. You might get symptoms for a day or two, then carry on. Elimination is about your overall pattern, not perfection. Beating yourself up causes stress, which is itself a gut trigger.' },
  { id: 'g14', topic: 'elimination', q: 'Can I eat out during elimination?', a: 'It is hard but possible. Stick to simple grilled meat or fish with rice or potatoes, ask for no onion and no garlic, and keep sauces on the side. The honest truth is that elimination is the phase where cooking at home makes life much easier.' },
  { id: 'g15', topic: 'elimination', q: 'Why is onion in everything?', a: 'Onion and garlic are flavour bases for most cuisines, and onion is the single most common IBS trigger — around 80% of people react. The good news: the green tops of spring onions are low-FODMAP, and garlic-infused oil gives garlic flavour without the fructans.' },
  { id: 'g16', topic: 'elimination', q: 'Am I getting enough nutrients on elimination?', a: 'It is a real risk if you are not careful — cutting wheat, dairy and many fruits and vegetables can reduce fibre, calcium and other nutrients. Keep your diet as varied as possible within the low-FODMAP list, and this is exactly why the phase should be short and ideally dietitian-supported.' },
  { id: 'g17', topic: 'elimination', q: 'Can I exercise normally during elimination?', a: 'Yes — exercise is good for IBS and helps gut motility. Just be aware that low-FODMAP eating can mean fewer carbohydrates than you are used to, so fuel adequately around workouts with safe options like rice, potatoes and bananas.' },
  { id: 'g18', topic: 'elimination', q: 'Will I lose weight on elimination?', a: 'Low-FODMAP is not a weight-loss diet and is not designed for it. Some people lose a little because they cook more and cut processed food; others gain because they lean on gluten-free processed foods. Weight change is a side effect, not a goal.' },
  { id: 'g19', topic: 'elimination', q: 'Can I do elimination while pregnant?', a: 'Only with direct supervision from your doctor and a dietitian. Pregnancy raises your nutritional needs, and a restrictive diet without guidance is risky. Do not start it solo while pregnant.' },
  { id: 'g20', topic: 'elimination', q: 'How do I know I am ready to move on from elimination?', a: 'When your symptoms have clearly settled and stayed stable for at least a week or two, and you have completed at least 2-4 weeks. A calm, stable baseline is what makes reintroduction results trustworthy — if you are still flaring, you cannot read the tests cleanly.' },
  { id: 'g21', topic: 'reintro', q: 'What is the point of reintroduction?', a: 'Elimination tells you that FODMAPs matter. Reintroduction tells you which ones, and how much you can handle. Without it you are stuck on a needlessly strict diet forever. This is the phase that actually gives you your personal, liveable diet.' },
  { id: 'g22', topic: 'reintro', q: 'How does a single FODMAP challenge work?', a: 'You pick one food that contains only one FODMAP group — for example milk for lactose. You eat a small portion day 1, medium day 2, large day 3, while keeping the rest of your diet low-FODMAP. You track symptoms. If you react, you stop and note your threshold.' },
  { id: 'g23', topic: 'reintro', q: 'What order should I test FODMAP groups in?', a: 'There is no single mandatory order, but many people start with lactose and fructose because they are often better tolerated, then move to polyols and fructans. The app guides you through a sensible sequence. Testing one group at a time is the rule that matters most.' },
  { id: 'g24', topic: 'reintro', q: 'Should I keep eating low-FODMAP between challenges?', a: 'Yes. Between each challenge you return to the low-FODMAP baseline for a rest period. This lets any reaction settle so the next test starts from a clean slate. Testing back-to-back with no rest makes the results impossible to read.' },
  { id: 'g25', topic: 'reintro', q: 'I reacted to a food. Can I never eat it again?', a: 'Not necessarily. A reaction tells you your current threshold, not a life sentence. Many people tolerate a small portion even of a food that fails at a large one. And tolerance can change over time — it is worth retesting failed foods every few months.' },
  { id: 'g26', topic: 'reintro', q: 'I tolerated a food in the test. Can I eat it freely now?', a: 'Mostly yes, but reintroduce it gradually rather than suddenly eating large amounts daily. Also watch for stacking — a tolerated food plus other moderate foods in the same meal can still add up.' },
  { id: 'g27', topic: 'reintro', q: 'How long does the whole reintroduction phase take?', a: 'Typically 6-10 weeks, because each challenge is 3 days plus a rest period, and there are six FODMAP groups. It is slower than elimination, but it is the phase that gives you lasting freedom, so it is worth the patience.' },
  { id: 'g28', topic: 'reintro', q: 'What if my reaction is unclear — mild or maybe-not-real?', a: 'It happens. Note it as inconclusive and move on; you can retest that group later. Do not agonise over a borderline result. If something is genuinely a trigger, the pattern tends to repeat clearly on retest.' },
  { id: 'g29', topic: 'reintro', q: 'Should I pause testing during my period?', a: 'Many people choose to. Hormonal shifts around menstruation can amplify gut symptoms by 30-40%, which can make a food look like a trigger when it is really the hormones. Testing during a hormonally stable window gives cleaner results.' },
  { id: 'g30', topic: 'reintro', q: 'Can I test two foods at once to save time?', a: 'No — this is the most common reintroduction mistake. If you test two groups together and react, you have no idea which one caused it. One group at a time is the entire logic of the phase. Saving a week is not worth losing the answer.' },
  { id: 'g31', topic: 'reintro', q: 'What foods are used to test each group?', a: 'Each test uses a food high in just one FODMAP: milk or yogurt for lactose, honey or mango for fructose, apple or pear for sorbitol, mushroom for mannitol, lentils or chickpeas for GOS, bread or onion for fructans. The app gives you the portions for each.' },
  { id: 'g32', topic: 'reintro', q: 'I failed every challenge. What now?', a: 'First, make sure your baseline was truly calm before testing — flaring during tests causes false fails. If results still all look negative, this is a strong signal to work with a dietitian, as there may be non-FODMAP factors like stress, motility or another condition.' },
  { id: 'g33', topic: 'reintro', q: 'Do I need to retest foods later?', a: 'It is a good idea. Gut tolerance is not fixed — it can improve as your gut settles, or shift over years. Retesting failed groups every few months can slowly expand your safe list. A trigger today is not necessarily a trigger forever.' },
  { id: 'g34', topic: 'eatingout', q: 'What is generally safe at an Italian restaurant?', a: 'Grilled meat or fish, a simple rocket and parmesan salad, or pasta with olive oil and parmesan. Ask for no onion and no garlic. Gluten-free pasta is increasingly available. Skip cream sauces and anything built on a heavy onion-garlic soffritto base.' },
  { id: 'g35', topic: 'eatingout', q: 'What is generally safe at an Indian restaurant?', a: 'Plain rice, tandoori meats (yogurt-marinated but grilled, often tolerated) and plain dosa tend to be safer. The hard part is that most curries are built on an onion-garlic base, naan is wheat, and dal and chana are legumes. Ask whether a dish can be made without onion and garlic.' },
  { id: 'g36', topic: 'eatingout', q: 'What is generally safe at a Chinese restaurant?', a: 'Steamed rice, plain steamed or grilled protein, and simple stir-fried greens like bok choy. The challenge is that onion, garlic and wheat-based sauces are everywhere; soy sauce is usually fine in small amounts. Ask for dishes cooked without onion and garlic, sauce light.' },
  { id: 'g37', topic: 'eatingout', q: 'What is safe at an American or burger place?', a: 'A burger patty without the bun, or with a gluten-free bun, plus plain fries (usually low-FODMAP) and a simple side salad without dressing. Skip the standard bun, onion, BBQ sauce and onion rings. Plain grilled chicken is a reliable fallback.' },
  { id: 'g38', topic: 'eatingout', q: 'How do I ask about ingredients without being awkward?', a: 'Keep it short and framed as a medical need: "I have a digestive condition — can this be made without onion and garlic?" Most kitchens handle this routinely. Calling it a medical requirement is taken more seriously than calling it a preference.' },
  { id: 'g39', topic: 'eatingout', q: 'Hidden FODMAPs to watch for when eating out?', a: 'Onion and garlic in almost every sauce, stock and dressing; wheat as a thickener in gravies and soups; high-fructose ingredients in marinades and glazes; and large portions turning a moderate food high. When unsure, choose simply-prepared dishes.' },
  { id: 'g40', topic: 'eatingout', q: 'Should I just eat before I go out?', a: 'It is a valid strategy for tricky events — eat a safe meal first, then have something small and low-risk at the restaurant. It removes pressure. But long term the goal of reintroduction is to widen what you can order, so use this as a bridge, not a permanent plan.' },
  { id: 'g41', topic: 'lifestyle', q: 'Why do symptoms get worse when I am stressed?', a: 'The gut and brain are directly connected via the gut-brain axis. Stress changes gut motility, sensitivity and even bacterial balance. This is why a "safe" meal can still cause symptoms on a high-stress day — and why stress management is part of IBS care, not separate from it.' },
  { id: 'g42', topic: 'lifestyle', q: 'Does poor sleep affect my gut?', a: 'Yes. Poor or short sleep is linked to worse IBS symptoms the next day, partly through stress hormones and partly through the gut-brain axis. If the app shows your bad days following short nights, that is a real and common pattern.' },
  { id: 'g43', topic: 'lifestyle', q: 'Can my menstrual cycle change my symptoms?', a: 'Yes. Many people notice worse bloating, pain and bowel changes around their period. Hormonal shifts can amplify gut symptoms by 30-40%. Tracking your cycle alongside symptoms helps separate hormone-driven days from food-driven ones.' },
  { id: 'g44', topic: 'lifestyle', q: 'Does exercise help or hurt IBS?', a: 'Regular moderate exercise generally helps — it supports healthy gut motility and reduces stress. Very intense endurance exercise can sometimes trigger symptoms. Gentle, consistent movement like walking or yoga is well tolerated and beneficial for most.' },
  { id: 'g45', topic: 'lifestyle', q: 'How fast after eating do FODMAP symptoms appear?', a: 'It varies. Some symptoms appear within 1-2 hours as food reaches the small intestine; gas and bloating from fermentation often peak 4-8 hours later when food reaches the large intestine. This delay is why a food diary with timing is so useful — the culprit is often an earlier meal.' },
  { id: 'g46', topic: 'lifestyle', q: 'Why do I bloat even when I eat carefully?', a: 'Bloating is not always about FODMAPs. Stress, swallowed air, eating quickly, large meal volumes, hormonal cycles and gut motility all contribute. If your log shows bloating with no clear food link, look at these other factors.' },
  { id: 'g47', topic: 'longterm', q: 'What happens after I finish reintroduction?', a: 'You move into the personalised maintenance phase: you eat as varied a diet as possible, only limiting the specific FODMAPs and portions that genuinely trigger you. This is the goal of the whole process — the least restrictive diet that keeps you comfortable.' },
  { id: 'g48', topic: 'longterm', q: 'Is it bad to stay strictly low-FODMAP forever?', a: 'Yes, it is not recommended. Long-term strict restriction can reduce the diversity of your gut bacteria, which matters for overall gut health, and raises the risk of nutritional gaps. Reintroduction exists precisely so you do not have to stay strict.' },
  { id: 'g49', topic: 'longterm', q: 'My triggers seem to have changed over time. Is that normal?', a: 'Yes, completely. Gut tolerance is dynamic — it shifts with stress, life stage, gut health and time. This is why retesting old triggers periodically is worthwhile; foods that failed a year ago may be fine now.' },
  { id: 'g50', topic: 'longterm', q: 'Can my IBS ever go away completely?', a: 'IBS is a chronic condition, so it is more accurate to think in terms of good management than a cure. That said, many people reach a point where symptoms are mild, infrequent and well-controlled, and the diet feels almost normal. That stable, liveable state is a realistic goal.' },
];

// Translations for GutGuide Q&As, keyed by question id, then language.
// MEDICAL CONTENT — each entry should be reviewed by a native speaker before
// being relied upon. Entries are added incrementally; any id missing a given
// language falls back to the English text on the GUT_GUIDE item itself.
const GUIDE_I18N = {
  // ── BATCH 1 — foundational questions. Pending native-speaker review. ──
  g1: {
    de: { q: 'Wofür steht FODMAP eigentlich?', a: 'Fermentierbare Oligosaccharide, Disaccharide, Monosaccharide und Polyole. Das sind kurzkettige Kohlenhydrate, die im Dünndarm schlecht aufgenommen werden. In empfindlichen Därmen ziehen sie Wasser an und werden von Bakterien vergoren, wodurch Gas entsteht — das führt zu Blähungen, Schmerzen und veränderter Verdauung.' },
    es: { q: '¿Qué significa realmente FODMAP?', a: 'Oligosacáridos, Disacáridos, Monosacáridos y Polioles Fermentables. Son hidratos de carbono de cadena corta que se absorben mal en el intestino delgado. En intestinos sensibles atraen agua y las bacterias los fermentan, produciendo gas, lo que provoca hinchazón, dolor y cambios en el tránsito intestinal.' },
    fr: { q: 'Que signifie réellement FODMAP ?', a: 'Oligosaccharides, Disaccharides, Monosaccharides Et Polyols Fermentescibles. Ce sont des glucides à chaîne courte mal absorbés dans l\'intestin grêle. Dans les intestins sensibles, ils attirent l\'eau et sont fermentés par les bactéries, produisant des gaz — d\'où ballonnements, douleurs et changements du transit.' },
    it: { q: 'Cosa significa davvero FODMAP?', a: 'Oligosaccaridi, Disaccaridi, Monosaccaridi e Polioli Fermentabili. Sono carboidrati a catena corta assorbiti male nell\'intestino tenue. Negli intestini sensibili richiamano acqua e vengono fermentati dai batteri, producendo gas — il che causa gonfiore, dolore e alterazioni dell\'intestino.' },
  },
  g2: {
    de: { q: 'Ist die Low-FODMAP-Diät eine Diät für immer?', a: 'Nein — und das ist wichtig. Sie ist ein kurzfristiges diagnostisches Hilfsmittel, kein Lebensstil. Die strenge Phase dauert nur 2–6 Wochen. Der ganze Sinn ist, Lebensmittel danach wieder einzuführen und am Ende die abwechslungsreichste Ernährung zu haben, die du verträgst. Dauerhaft streng zu bleiben kann deine Darmbakterien schädigen und birgt das Risiko von Nährstofflücken.' },
    es: { q: '¿La dieta baja en FODMAP es para siempre?', a: 'No — y esto es importante. Es una herramienta de diagnóstico a corto plazo, no un estilo de vida. La fase estricta dura solo 2–6 semanas. El objetivo es reintroducir alimentos después y acabar con la dieta más variada que toleres. Mantenerse estricto a largo plazo puede dañar tu flora intestinal y conlleva riesgo de carencias nutricionales.' },
    fr: { q: 'Le régime pauvre en FODMAP est-il à vie ?', a: 'Non — et c\'est important. C\'est un outil de diagnostic à court terme, pas un mode de vie. La phase stricte ne dure que 2 à 6 semaines. Le but est de réintroduire ensuite les aliments et d\'aboutir à l\'alimentation la plus variée que tu tolères. Rester strict longtemps peut nuire à ta flore intestinale et risque de créer des carences.' },
    it: { q: 'La dieta low-FODMAP è per sempre?', a: 'No — ed è importante saperlo. È uno strumento diagnostico a breve termine, non uno stile di vita. La fase rigorosa dura solo 2–6 settimane. Lo scopo è reintrodurre poi gli alimenti e arrivare alla dieta più varia che riesci a tollerare. Restare rigorosi a lungo può danneggiare i batteri intestinali e rischia di creare carenze nutrizionali.' },
  },
  g11: {
    de: { q: 'Wie lange sollte die Eliminierungsphase dauern?', a: 'Zwei bis sechs Wochen. Die meisten Menschen wissen innerhalb von 2–4 Wochen, ob FODMAPs beteiligt sind. Geh nicht über sechs Wochen hinaus — die Phase ist einschränkend, belastet dein Darmmikrobiom, und wenn sich die Symptome bis dahin nicht gebessert haben, sind FODMAPs vielleicht nicht dein Hauptproblem.' },
    es: { q: '¿Cuánto debe durar la fase de eliminación?', a: 'De dos a seis semanas. La mayoría sabe en 2–4 semanas si los FODMAP están implicados. No superes las seis semanas: es restrictiva, exige mucho a tu microbiota intestinal y, si los síntomas no han mejorado para entonces, puede que los FODMAP no sean tu problema principal.' },
    fr: { q: 'Combien de temps doit durer la phase d\'élimination ?', a: 'De deux à six semaines. La plupart des gens savent en 2 à 4 semaines si les FODMAP sont en cause. Ne dépasse pas six semaines — la phase est restrictive, sollicite ton microbiote intestinal, et si les symptômes ne se sont pas améliorés d\'ici là, les FODMAP ne sont peut-être pas ton problème principal.' },
    it: { q: 'Quanto dovrebbe durare la fase di eliminazione?', a: 'Da due a sei settimane. La maggior parte delle persone capisce entro 2–4 settimane se i FODMAP sono coinvolti. Non superare le sei settimane: è restrittiva, mette sotto sforzo il microbiota intestinale e, se i sintomi non sono migliorati entro allora, i FODMAP potrebbero non essere il problema principale.' },
  },
  g30: {
    de: { q: 'Kann ich zwei Lebensmittel gleichzeitig testen, um Zeit zu sparen?', a: 'Nein — das ist der häufigste Fehler bei der Wiedereinführung. Wenn du zwei Gruppen zusammen testest und reagierst, weißt du nicht, welche die Ursache war. Eine Gruppe nach der anderen zu testen ist die ganze Logik dieser Phase. Eine Woche zu sparen ist es nicht wert, die Antwort zu verlieren.' },
    es: { q: '¿Puedo probar dos alimentos a la vez para ahorrar tiempo?', a: 'No — es el error más común de la reintroducción. Si pruebas dos grupos juntos y reaccionas, no sabrás cuál lo causó. Probar un grupo cada vez es toda la lógica de esta fase. Ahorrar una semana no compensa perder la respuesta.' },
    fr: { q: 'Puis-je tester deux aliments à la fois pour gagner du temps ?', a: 'Non — c\'est l\'erreur la plus fréquente de la réintroduction. Si tu testes deux groupes ensemble et que tu réagis, tu ne sauras pas lequel est en cause. Tester un groupe à la fois est toute la logique de cette phase. Gagner une semaine ne vaut pas la perte de la réponse.' },
    it: { q: 'Posso testare due alimenti insieme per risparmiare tempo?', a: 'No — è l\'errore più comune della reintroduzione. Se testi due gruppi insieme e reagisci, non saprai quale li ha causati. Testare un gruppo alla volta è tutta la logica di questa fase. Risparmiare una settimana non vale la perdita della risposta.' },
  },
  g41: {
    de: { q: 'Warum werden meine Symptome bei Stress schlimmer?', a: 'Darm und Gehirn sind über die Darm-Hirn-Achse direkt verbunden. Stress verändert die Darmbewegung, die Empfindlichkeit und sogar das bakterielle Gleichgewicht. Deshalb kann eine „sichere" Mahlzeit an einem stressigen Tag trotzdem Symptome auslösen — und deshalb gehört Stressbewältigung zur Behandlung des Reizdarms dazu.' },
    es: { q: '¿Por qué empeoran mis síntomas cuando estoy estresado?', a: 'El intestino y el cerebro están conectados directamente por el eje intestino-cerebro. El estrés altera la motilidad intestinal, la sensibilidad e incluso el equilibrio bacteriano. Por eso una comida «segura» puede causar síntomas en un día de mucho estrés, y por eso gestionar el estrés forma parte del tratamiento del SII.' },
    fr: { q: 'Pourquoi mes symptômes empirent-ils quand je suis stressé ?', a: 'L\'intestin et le cerveau sont directement reliés par l\'axe intestin-cerveau. Le stress modifie la motilité intestinale, la sensibilité et même l\'équilibre bactérien. C\'est pourquoi un repas « sûr » peut quand même provoquer des symptômes un jour de stress — et pourquoi la gestion du stress fait partie du traitement du SII.' },
    it: { q: 'Perché i sintomi peggiorano quando sono stressato?', a: 'Intestino e cervello sono collegati direttamente tramite l\'asse intestino-cervello. Lo stress altera la motilità intestinale, la sensibilità e perfino l\'equilibrio batterico. Per questo un pasto "sicuro" può comunque causare sintomi in una giornata stressante — ed è per questo che gestire lo stress fa parte della cura del colon irritabile.' },
  },
  // ── BATCH 2 — pending native-speaker review. ──
  g3: {
    de: { q: 'Ist Low-FODMAP dasselbe wie glutenfrei?', a: 'Nein. Gluten ist ein Eiweiß; FODMAPs sind Kohlenhydrate. Weizen ist wegen der Fruktane FODMAP-reich, nicht wegen Gluten. Viele Menschen mit Low-FODMAP-Ernährung vertragen Dinkel-Sauerteig, der Gluten enthält. Solange du keine Zöliakie hast, meidest du Fruktane, nicht Gluten selbst.' },
    es: { q: '¿Bajo en FODMAP es lo mismo que sin gluten?', a: 'No. El gluten es una proteína; los FODMAP son hidratos de carbono. El trigo es alto en FODMAP por los fructanos, no por el gluten. Muchas personas con dieta baja en FODMAP toleran la masa madre de espelta, que contiene gluten. Salvo que tengas celiaquía, estás evitando fructanos, no gluten.' },
    fr: { q: 'Pauvre en FODMAP, est-ce la même chose que sans gluten ?', a: 'Non. Le gluten est une protéine ; les FODMAP sont des glucides. Le blé est riche en FODMAP à cause des fructanes, pas du gluten. Beaucoup de personnes au régime pauvre en FODMAP tolèrent le levain d\'épeautre, qui contient du gluten. Sauf maladie cœliaque, tu évites les fructanes, pas le gluten lui-même.' },
    it: { q: 'Low-FODMAP è lo stesso che senza glutine?', a: 'No. Il glutine è una proteina; i FODMAP sono carboidrati. Il grano è ricco di FODMAP per i fruttani, non per il glutine. Molte persone a dieta low-FODMAP tollerano la pasta madre di farro, che contiene glutine. Se non hai la celiachia, stai evitando i fruttani, non il glutine.' },
  },
  g4: {
    de: { q: 'Heilt Low-FODMAP meinen Reizdarm?', a: 'Es heilt den Reizdarm nicht — es gibt keine Heilung. Aber für etwa 60–85 % der Menschen mit Reizdarm bringt das Erkennen und Steuern der Auslöser-Lebensmittel eine deutliche, anhaltende Linderung. Es ist ein Hilfsmittel zur Bewältigung, und für die meisten ein sehr wirksames.' },
    es: { q: '¿La dieta baja en FODMAP curará mi SII?', a: 'No cura el SII — no existe cura. Pero para alrededor del 60–85 % de las personas con SII, identificar y manejar los alimentos desencadenantes da un alivio significativo y duradero. Es una herramienta de gestión, y muy eficaz para la mayoría.' },
    fr: { q: 'Le régime pauvre en FODMAP guérira-t-il mon SII ?', a: 'Il ne guérit pas le SII — il n\'existe pas de guérison. Mais pour environ 60 à 85 % des personnes atteintes de SII, identifier et gérer les aliments déclencheurs apporte un soulagement important et durable. C\'est un outil de gestion, très efficace pour la plupart.' },
    it: { q: 'La dieta low-FODMAP curerà il mio colon irritabile?', a: 'Non cura il colon irritabile — non esiste una cura. Ma per circa il 60–85% delle persone con colon irritabile, individuare e gestire gli alimenti scatenanti porta un sollievo significativo e duraturo. È uno strumento di gestione, e per la maggior parte molto efficace.' },
  },
  g5: {
    de: { q: 'Sollte ich das ohne Arzt machen?', a: 'Am besten nicht. Du solltest zuerst eine Reizdarm-Diagnose haben, denn dieselben Symptome können von Zöliakie, chronisch-entzündlichen Darmerkrankungen oder anderen Erkrankungen kommen, die eine andere Behandlung brauchen. Eine FODMAP-geschulte Ernährungsfachkraft verbessert den Erfolg deutlich und schützt vor Nährstofflücken. Diese App begleitet den Weg — sie ersetzt diese Diagnose nicht.' },
    es: { q: '¿Debería hacer esto sin un médico?', a: 'Lo ideal es que no. Primero deberías tener un diagnóstico de SII, porque los mismos síntomas pueden deberse a celiaquía, enfermedad inflamatoria intestinal u otras afecciones que requieren un tratamiento distinto. Un dietista formado en FODMAP mejora mucho el éxito y protege frente a carencias. Esta app acompaña el proceso — no sustituye ese diagnóstico.' },
    fr: { q: 'Devrais-je le faire sans médecin ?', a: 'Idéalement non. Tu devrais d\'abord avoir un diagnostic de SII, car les mêmes symptômes peuvent venir d\'une maladie cœliaque, d\'une MICI ou d\'autres affections nécessitant un traitement différent. Un diététicien formé aux FODMAP améliore nettement les résultats et protège des carences. Cette app accompagne le parcours — elle ne remplace pas ce diagnostic.' },
    it: { q: 'Dovrei farlo senza un medico?', a: 'Idealmente no. Dovresti prima avere una diagnosi di colon irritabile, perché gli stessi sintomi possono derivare da celiachia, malattie infiammatorie intestinali o altre condizioni che richiedono cure diverse. Un dietista esperto di FODMAP migliora molto i risultati e protegge dalle carenze. Questa app accompagna il percorso — non sostituisce quella diagnosi.' },
  },
  g6: {
    de: { q: 'Was sind die wichtigsten FODMAP-Gruppen?', a: 'Sechs: Fruktane (Weizen, Zwiebel, Knoblauch), GOS (Hülsenfrüchte, einige Nüsse), Laktose (Milchprodukte), überschüssige Fruktose (Honig, Apfel, Mango), Sorbit und Mannit (die beiden Polyole, in Steinobst und Pilzen). Du kannst auf einige reagieren und auf andere nicht — genau das findet die Wiedereinführung heraus.' },
    es: { q: '¿Cuáles son los principales grupos FODMAP?', a: 'Seis: fructanos (trigo, cebolla, ajo), GOS (legumbres, algunos frutos secos), lactosa (lácteos), exceso de fructosa (miel, manzana, mango), sorbitol y manitol (los dos polioles, en fruta de hueso y setas). Puedes reaccionar a unos y no a otros — eso es lo que averigua la reintroducción.' },
    fr: { q: 'Quels sont les principaux groupes de FODMAP ?', a: 'Six : fructanes (blé, oignon, ail), GOS (légumineuses, certaines noix), lactose (produits laitiers), excès de fructose (miel, pomme, mangue), sorbitol et mannitol (les deux polyols, dans les fruits à noyau et les champignons). Tu peux réagir à certains et pas à d\'autres — c\'est ce que détermine la réintroduction.' },
    it: { q: 'Quali sono i principali gruppi FODMAP?', a: 'Sei: fruttani (grano, cipolla, aglio), GOS (legumi, alcune frutta secca), lattosio (latticini), eccesso di fruttosio (miele, mela, mango), sorbitolo e mannitolo (i due polioli, nella frutta con nocciolo e nei funghi). Puoi reagire ad alcuni e non ad altri — è questo che scopre la reintroduzione.' },
  },
  g7: {
    de: { q: 'Warum ist die Portionsgröße so wichtig?', a: 'FODMAPs summieren sich. Ein Lebensmittel kann in kleiner Portion FODMAP-arm und in großer FODMAP-reich sein, weil die FODMAP-Last deine Schwelle überschreitet. Deshalb zeigt die App Gramm-Hinweise statt eines einfachen Ja/Nein — eine halbe Portion kann in Ordnung sein, wo eine ganze es nicht ist.' },
    es: { q: '¿Por qué importa tanto el tamaño de la porción?', a: 'Los FODMAP se acumulan. Un alimento puede ser bajo en FODMAP en una porción pequeña y alto en una grande, porque la carga de FODMAP supera tu umbral. Por eso la app muestra orientación en gramos en vez de un simple sí/no — media porción puede estar bien donde una entera no lo está.' },
    fr: { q: 'Pourquoi la taille des portions compte-t-elle autant ?', a: 'Les FODMAP s\'additionnent. Un aliment peut être pauvre en FODMAP en petite portion et riche en grande, car la charge en FODMAP dépasse ton seuil. C\'est pourquoi l\'app indique des repères en grammes plutôt qu\'un simple oui/non — une demi-portion peut convenir là où une entière ne convient pas.' },
    it: { q: 'Perché la dimensione della porzione conta così tanto?', a: 'I FODMAP si sommano. Un alimento può essere povero di FODMAP in una porzione piccola e ricco in una grande, perché il carico di FODMAP supera la tua soglia. Per questo l\'app mostra indicazioni in grammi invece di un semplice sì/no — mezza porzione può andare bene dove una intera no.' },
  },
  g12: {
    de: { q: 'Was, wenn sich meine Symptome während der Eliminierung nicht bessern?', a: 'Wenn du sorgfältig 4–6 Wochen ohne Besserung durchgeführt hast, sind FODMAPs vielleicht nicht dein Auslöser. Das ist eine nützliche Information. Andere Wege, die du mit einer Ärztin besprechen solltest: Stress und die Darm-Hirn-Achse, darmgerichtete Hypnotherapie, Medikamente oder ein erneutes Prüfen der ursprünglichen Diagnose.' },
    es: { q: '¿Y si mis síntomas no mejoran durante la eliminación?', a: 'Si has hecho con cuidado 4–6 semanas sin mejoría, puede que los FODMAP no sean tu desencadenante. Eso es información útil. Otras vías que conviene hablar con un médico: el estrés y el eje intestino-cerebro, la hipnoterapia dirigida al intestino, medicamentos o revisar el diagnóstico inicial.' },
    fr: { q: 'Et si mes symptômes ne s\'améliorent pas pendant l\'élimination ?', a: 'Si tu as fait soigneusement 4 à 6 semaines sans amélioration, les FODMAP ne sont peut-être pas ton déclencheur. C\'est une information utile. Autres pistes à discuter avec un médecin : le stress et l\'axe intestin-cerveau, l\'hypnothérapie centrée sur l\'intestin, des médicaments, ou revoir le diagnostic initial.' },
    it: { q: 'E se i sintomi non migliorano durante l\'eliminazione?', a: 'Se hai fatto con cura 4–6 settimane senza miglioramenti, i FODMAP potrebbero non essere il tuo fattore scatenante. È un\'informazione utile. Altre strade da discutere con un medico: lo stress e l\'asse intestino-cervello, l\'ipnoterapia mirata all\'intestino, i farmaci o un riesame della diagnosi iniziale.' },
  },
  g13: {
    de: { q: 'Ich habe versehentlich etwas FODMAP-Reiches gegessen. Habe ich alles ruiniert?', a: 'Nein. Ein Ausrutscher setzt die Uhr nicht zurück. Du bekommst vielleicht ein, zwei Tage Symptome; dann mach weiter. Bei der Eliminierung geht es um dein Gesamtmuster, nicht um Perfektion. Sich selbst fertigzumachen verursacht Stress, der selbst ein Darm-Auslöser ist.' },
    es: { q: 'He comido algo alto en FODMAP sin querer. ¿Lo he estropeado todo?', a: 'No. Un desliz no reinicia el contador. Puede que tengas síntomas un día o dos; luego continúa. La eliminación se trata de tu patrón general, no de la perfección. Castigarte genera estrés, que es en sí mismo un desencadenante intestinal.' },
    fr: { q: 'J\'ai mangé un aliment riche en FODMAP par accident. Ai-je tout gâché ?', a: 'Non. Un écart ne remet pas le compteur à zéro. Tu auras peut-être des symptômes un jour ou deux ; ensuite, continue. L\'élimination concerne ton schéma global, pas la perfection. Culpabiliser génère du stress, qui est lui-même un déclencheur intestinal.' },
    it: { q: 'Ho mangiato per sbaglio qualcosa di ricco di FODMAP. Ho rovinato tutto?', a: 'No. Una scivolata non azzera il conteggio. Potresti avere sintomi per un giorno o due; poi continua. L\'eliminazione riguarda il tuo schema generale, non la perfezione. Colpevolizzarsi genera stress, che è di per sé un fattore scatenante intestinale.' },
  },
  g14: {
    de: { q: 'Kann ich während der Eliminierung auswärts essen?', a: 'Es ist schwierig, aber möglich. Halte dich an einfaches gegrilltes Fleisch oder Fisch mit Reis oder Kartoffeln, bitte um kein Zwiebel und keinen Knoblauch, und lass Soßen separat servieren. Die ehrliche Wahrheit ist: Die Eliminierung ist die Phase, in der Kochen zu Hause das Leben deutlich leichter macht.' },
    es: { q: '¿Puedo comer fuera durante la eliminación?', a: 'Es difícil pero posible. Quédate con carne o pescado a la plancha sencillos con arroz o patatas, pide sin cebolla ni ajo, y deja las salsas aparte. La verdad honesta es que la eliminación es la fase en la que cocinar en casa hace la vida mucho más fácil.' },
    fr: { q: 'Puis-je manger au restaurant pendant l\'élimination ?', a: 'C\'est difficile mais possible. Reste sur de la viande ou du poisson grillés simples avec du riz ou des pommes de terre, demande sans oignon ni ail, et fais servir les sauces à part. La vérité honnête : l\'élimination est la phase où cuisiner chez soi rend la vie bien plus facile.' },
    it: { q: 'Posso mangiare fuori durante l\'eliminazione?', a: 'È difficile ma possibile. Resta su carne o pesce grigliati semplici con riso o patate, chiedi senza cipolla e senza aglio, e fai servire le salse a parte. La verità onesta è che l\'eliminazione è la fase in cui cucinare a casa rende la vita molto più facile.' },
  },
  g15: {
    de: { q: 'Warum ist überall Zwiebel drin?', a: 'Zwiebel und Knoblauch sind die Geschmacksbasis der meisten Küchen, und Zwiebel ist der häufigste Reizdarm-Auslöser — etwa 80 % der Menschen reagieren. Die gute Nachricht: Das Grün von Frühlingszwiebeln ist FODMAP-arm, und Knoblauchöl gibt Knoblauchgeschmack ohne die Fruktane.' },
    es: { q: '¿Por qué hay cebolla en todo?', a: 'La cebolla y el ajo son la base de sabor de casi todas las cocinas, y la cebolla es el desencadenante más común del SII — alrededor del 80 % de las personas reaccionan. La buena noticia: la parte verde de la cebolleta es baja en FODMAP, y el aceite de ajo aporta sabor a ajo sin los fructanos.' },
    fr: { q: 'Pourquoi y a-t-il de l\'oignon partout ?', a: 'L\'oignon et l\'ail sont la base aromatique de la plupart des cuisines, et l\'oignon est le déclencheur le plus fréquent du SII — environ 80 % des personnes réagissent. La bonne nouvelle : la partie verte de l\'oignon nouveau est pauvre en FODMAP, et l\'huile d\'ail donne le goût d\'ail sans les fructanes.' },
    it: { q: 'Perché c\'è cipolla dappertutto?', a: 'Cipolla e aglio sono la base aromatica della maggior parte delle cucine, e la cipolla è il fattore scatenante più comune del colon irritabile — circa l\'80% delle persone reagisce. La buona notizia: la parte verde del cipollotto è povera di FODMAP, e l\'olio all\'aglio dà sapore di aglio senza i fruttani.' },
  },
  g21: {
    de: { q: 'Was ist der Sinn der Wiedereinführung?', a: 'Die Eliminierung sagt dir, dass FODMAPs eine Rolle spielen. Die Wiedereinführung sagt dir, welche und wie viel du verträgst. Ohne sie steckst du dauerhaft in einer unnötig strengen Ernährung fest. Das ist die Phase, die dir tatsächlich deine persönliche, lebbare Ernährung gibt.' },
    es: { q: '¿Cuál es el sentido de la reintroducción?', a: 'La eliminación te dice que los FODMAP importan. La reintroducción te dice cuáles y cuánto puedes tolerar. Sin ella te quedas atascado para siempre en una dieta innecesariamente estricta. Es la fase que de verdad te da tu dieta personal y llevadera.' },
    fr: { q: 'Quel est l\'intérêt de la réintroduction ?', a: 'L\'élimination te dit que les FODMAP comptent. La réintroduction te dit lesquels et quelle quantité tu tolères. Sans elle, tu restes bloqué pour toujours dans un régime inutilement strict. C\'est la phase qui te donne vraiment ton alimentation personnelle et vivable.' },
    it: { q: 'Qual è lo scopo della reintroduzione?', a: 'L\'eliminazione ti dice che i FODMAP contano. La reintroduzione ti dice quali e quanto ne tolleri. Senza di essa resti bloccato per sempre in una dieta inutilmente rigida. È la fase che ti dà davvero la tua dieta personale e sostenibile.' },
  },
  // ── BATCH 3 — pending native-speaker review. ──
  g8: {
    de: { q: 'Was ist FODMAP-Stacking?', a: 'Mehrere FODMAP-mittlere Lebensmittel in einer Mahlzeit zu essen, sodass ihre kombinierte Last hoch wird — obwohl kein einzelnes Lebensmittel es war. Eine mittlere Frucht, ein mittleres Getreide und ein mittleres Gemüse zusammen können dich über die Schwelle bringen. Die App markiert Mahlzeiten, bei denen das passiert.' },
    es: { q: '¿Qué es el efecto acumulativo de FODMAP?', a: 'Comer varios alimentos de FODMAP moderado en una misma comida de modo que su carga combinada sea alta, aunque ningún alimento por sí solo lo fuera. Una fruta moderada, un cereal moderado y una verdura moderada juntos pueden hacerte superar el umbral. La app señala las comidas en las que ocurre esto.' },
    fr: { q: 'Qu\'est-ce que l\'effet cumulatif des FODMAP ?', a: 'Manger plusieurs aliments à FODMAP modéré dans un même repas, de sorte que leur charge combinée devienne élevée — alors qu\'aucun aliment seul ne l\'était. Un fruit modéré, une céréale modérée et un légume modéré ensemble peuvent te faire dépasser le seuil. L\'app signale les repas où cela se produit.' },
    it: { q: 'Cos\'è l\'accumulo di FODMAP?', a: 'Mangiare diversi alimenti a FODMAP moderato in uno stesso pasto, così che il loro carico combinato diventi alto — anche se nessun alimento da solo lo era. Un frutto moderato, un cereale moderato e una verdura moderata insieme possono farti superare la soglia. L\'app segnala i pasti in cui questo accade.' },
  },
  g9: {
    de: { q: 'Darf ich bei Low-FODMAP Alkohol trinken?', a: 'Einige Optionen sind FODMAP-ärmer: Wein, Bier in geringen Mengen, Gin und Wodka. Rum und Dessertweine sind riskanter. Aber Alkohol reizt den Darm an sich, unabhängig von FODMAPs, und kann daher auch dann Symptome auslösen, wenn er technisch FODMAP-arm ist.' },
    es: { q: '¿Puedo beber alcohol con la dieta baja en FODMAP?', a: 'Algunas opciones son más bajas en FODMAP: vino, cerveza en cantidades moderadas, ginebra y vodka. El ron y los vinos de postre son más arriesgados. Pero el alcohol irrita el intestino por sí mismo, al margen de los FODMAP, así que puede provocar síntomas aunque técnicamente sea bajo en FODMAP.' },
    fr: { q: 'Puis-je boire de l\'alcool avec un régime pauvre en FODMAP ?', a: 'Certaines options sont plus pauvres en FODMAP : vin, bière en quantité modérée, gin et vodka. Le rhum et les vins de dessert sont plus risqués. Mais l\'alcool irrite l\'intestin en soi, indépendamment des FODMAP, et peut donc provoquer des symptômes même s\'il est techniquement pauvre en FODMAP.' },
    it: { q: 'Posso bere alcol con la dieta low-FODMAP?', a: 'Alcune opzioni sono più povere di FODMAP: vino, birra in quantità modeste, gin e vodka. Rum e vini da dessert sono più rischiosi. Ma l\'alcol irrita l\'intestino di per sé, a prescindere dai FODMAP, e quindi può causare sintomi anche quando è tecnicamente povero di FODMAP.' },
  },
  g10: {
    de: { q: 'Ist Kaffee erlaubt?', a: 'Schwarzer Kaffee ist FODMAP-arm. Aber Koffein regt den Darm an und kann von sich aus Symptome auslösen, und ein großer Milchkaffee fügt Laktose hinzu. Wenn Kaffee dich zu stören scheint, liegt das meist am Koffein, nicht an einem FODMAP.' },
    es: { q: '¿Se permite el café?', a: 'El café solo es bajo en FODMAP. Pero la cafeína estimula el intestino y puede provocar síntomas por sí misma, y un café con mucha leche añade lactosa. Si parece que el café te sienta mal, suele ser por la cafeína, no por un FODMAP.' },
    fr: { q: 'Le café est-il autorisé ?', a: 'Le café noir est pauvre en FODMAP. Mais la caféine stimule l\'intestin et peut provoquer des symptômes à elle seule, et un grand café au lait ajoute du lactose. Si le café semble te gêner, c\'est généralement la caféine, pas un FODMAP.' },
    it: { q: 'Il caffè è permesso?', a: 'Il caffè nero è povero di FODMAP. Ma la caffeina stimola l\'intestino e può causare sintomi di per sé, e un caffellatte abbondante aggiunge lattosio. Se il caffè sembra darti fastidio, di solito è la caffeina, non un FODMAP.' },
  },
  g16: {
    de: { q: 'Bekomme ich während der Eliminierung genug Nährstoffe?', a: 'Es ist ein echtes Risiko, wenn du nicht aufpasst — Weizen, Milchprodukte und viele Obst- und Gemüsesorten wegzulassen kann Ballaststoffe, Kalzium und andere Nährstoffe verringern. Halte deine Ernährung innerhalb der FODMAP-armen Liste so abwechslungsreich wie möglich, und genau deshalb sollte die Phase kurz und idealerweise von einer Ernährungsfachkraft begleitet sein.' },
    es: { q: '¿Recibo suficientes nutrientes durante la eliminación?', a: 'Es un riesgo real si no tienes cuidado — eliminar trigo, lácteos y muchas frutas y verduras puede reducir la fibra, el calcio y otros nutrientes. Mantén tu dieta lo más variada posible dentro de la lista baja en FODMAP, y precisamente por eso la fase debe ser corta e idealmente con apoyo de un dietista.' },
    fr: { q: 'Est-ce que j\'ai assez de nutriments pendant l\'élimination ?', a: 'C\'est un risque réel si tu ne fais pas attention — supprimer le blé, les produits laitiers et de nombreux fruits et légumes peut réduire les fibres, le calcium et d\'autres nutriments. Garde une alimentation aussi variée que possible dans la liste pauvre en FODMAP, et c\'est exactement pour ça que la phase doit être courte et idéalement suivie par un diététicien.' },
    it: { q: 'Assumo abbastanza nutrienti durante l\'eliminazione?', a: 'È un rischio reale se non stai attento — eliminare grano, latticini e molta frutta e verdura può ridurre fibre, calcio e altri nutrienti. Mantieni la dieta più varia possibile all\'interno della lista low-FODMAP, ed è proprio per questo che la fase dovrebbe essere breve e idealmente seguita da un dietista.' },
  },
  g17: {
    de: { q: 'Kann ich während der Eliminierung normal Sport treiben?', a: 'Ja — Bewegung ist gut bei Reizdarm und fördert die Darmbewegung. Beachte nur, dass Low-FODMAP-Ernährung weniger Kohlenhydrate bedeuten kann, als du gewohnt bist, also versorge dich rund um das Training ausreichend mit sicheren Optionen wie Reis, Kartoffeln und Bananen.' },
    es: { q: '¿Puedo hacer ejercicio con normalidad durante la eliminación?', a: 'Sí — el ejercicio es bueno para el SII y favorece la motilidad intestinal. Solo ten en cuenta que comer bajo en FODMAP puede suponer menos hidratos de los habituales, así que aliméntate bien alrededor del entrenamiento con opciones seguras como arroz, patatas y plátanos.' },
    fr: { q: 'Puis-je faire du sport normalement pendant l\'élimination ?', a: 'Oui — l\'exercice est bon pour le SII et favorise le transit. Garde simplement à l\'esprit que manger pauvre en FODMAP peut signifier moins de glucides que d\'habitude, alors alimente-toi bien autour de l\'entraînement avec des options sûres comme le riz, les pommes de terre et les bananes.' },
    it: { q: 'Posso fare sport normalmente durante l\'eliminazione?', a: 'Sì — l\'esercizio fa bene al colon irritabile e favorisce la motilità intestinale. Tieni solo presente che mangiare low-FODMAP può significare meno carboidrati del solito, quindi alimentati bene attorno all\'allenamento con opzioni sicure come riso, patate e banane.' },
  },
  g18: {
    de: { q: 'Werde ich bei der Eliminierung abnehmen?', a: 'Low-FODMAP ist keine Abnehm-Diät und ist nicht dafür gedacht. Manche nehmen etwas ab, weil sie mehr kochen und verarbeitete Lebensmittel weglassen; andere nehmen zu, weil sie sich auf glutenfreie Fertigprodukte stützen. Gewichtsveränderung ist eine Nebenwirkung, kein Ziel.' },
    es: { q: '¿Adelgazaré con la eliminación?', a: 'La dieta baja en FODMAP no es una dieta de adelgazamiento ni está pensada para eso. Algunas personas pierden algo de peso porque cocinan más y eliminan alimentos procesados; otras lo ganan porque recurren a productos procesados sin gluten. El cambio de peso es un efecto secundario, no un objetivo.' },
    fr: { q: 'Vais-je perdre du poids pendant l\'élimination ?', a: 'Le régime pauvre en FODMAP n\'est pas un régime amaigrissant et n\'est pas conçu pour ça. Certains perdent un peu de poids parce qu\'ils cuisinent plus et suppriment les aliments transformés ; d\'autres en prennent en se reposant sur des produits transformés sans gluten. Le changement de poids est un effet secondaire, pas un objectif.' },
    it: { q: 'Dimagrirò con l\'eliminazione?', a: 'La dieta low-FODMAP non è una dieta dimagrante e non è pensata per quello. Alcuni perdono un po\' di peso perché cucinano di più ed eliminano i cibi processati; altri lo guadagnano appoggiandosi a prodotti senza glutine processati. Il cambiamento di peso è un effetto collaterale, non un obiettivo.' },
  },
  g19: {
    de: { q: 'Kann ich die Eliminierung während der Schwangerschaft machen?', a: 'Nur unter direkter Begleitung deiner Ärztin und einer Ernährungsfachkraft. Eine Schwangerschaft erhöht deinen Nährstoffbedarf, und eine einschränkende Ernährung ohne Begleitung ist riskant. Beginne sie nicht allein während der Schwangerschaft.' },
    es: { q: '¿Puedo hacer la eliminación durante el embarazo?', a: 'Solo con supervisión directa de tu médico y un dietista. El embarazo aumenta tus necesidades nutricionales, y una dieta restrictiva sin orientación es arriesgada. No la empieces por tu cuenta durante el embarazo.' },
    fr: { q: 'Puis-je faire l\'élimination pendant la grossesse ?', a: 'Uniquement sous la supervision directe de ton médecin et d\'un diététicien. La grossesse augmente tes besoins nutritionnels, et un régime restrictif sans accompagnement est risqué. Ne la commence pas seule pendant la grossesse.' },
    it: { q: 'Posso fare l\'eliminazione durante la gravidanza?', a: 'Solo con la supervisione diretta del tuo medico e di un dietista. La gravidanza aumenta il fabbisogno di nutrienti, e una dieta restrittiva senza accompagnamento è rischiosa. Non iniziarla da sola durante la gravidanza.' },
  },
  g20: {
    de: { q: 'Woran erkenne ich, dass ich bereit bin, die Eliminierung zu beenden?', a: 'Wenn deine Symptome sich deutlich beruhigt haben und mindestens ein bis zwei Wochen stabil geblieben sind, und du mindestens 2–4 Wochen absolviert hast. Eine ruhige, stabile Ausgangslage macht die Ergebnisse der Wiedereinführung vertrauenswürdig — wenn es noch hochkocht, kannst du die Tests nicht klar lesen.' },
    es: { q: '¿Cómo sé que estoy listo para dejar la eliminación?', a: 'Cuando tus síntomas se hayan calmado claramente y se hayan mantenido estables al menos una o dos semanas, y hayas completado al menos 2–4 semanas. Una base tranquila y estable es lo que hace fiables los resultados de la reintroducción — si aún tienes brotes, no puedes leer las pruebas con claridad.' },
    fr: { q: 'Comment savoir si je suis prêt à arrêter l\'élimination ?', a: 'Quand tes symptômes se sont nettement calmés et sont restés stables au moins une à deux semaines, et que tu as fait au moins 2 à 4 semaines. Une base calme et stable est ce qui rend les résultats de la réintroduction fiables — si ça flambe encore, tu ne peux pas lire les tests clairement.' },
    it: { q: 'Come capisco di essere pronto a terminare l\'eliminazione?', a: 'Quando i sintomi si sono chiaramente calmati e sono rimasti stabili per almeno una o due settimane, e hai completato almeno 2–4 settimane. Una base calma e stabile è ciò che rende affidabili i risultati della reintroduzione — se hai ancora riacutizzazioni, non puoi leggere i test con chiarezza.' },
  },
  g22: {
    de: { q: 'Wie funktioniert eine einzelne FODMAP-Testung?', a: 'Du wählst ein Lebensmittel, das nur eine FODMAP-Gruppe enthält — zum Beispiel Milch für Laktose. Du isst an Tag 1 eine kleine Portion, an Tag 2 eine mittlere, an Tag 3 eine große, während du den Rest deiner Ernährung FODMAP-arm hältst. Du verfolgst die Symptome. Wenn du reagierst, hörst du auf und notierst deine Schwelle.' },
    es: { q: '¿Cómo funciona un reto de un solo FODMAP?', a: 'Eliges un alimento que contenga un solo grupo FODMAP — por ejemplo, leche para la lactosa. Comes una porción pequeña el día 1, mediana el día 2 y grande el día 3, manteniendo el resto de tu dieta baja en FODMAP. Anotas los síntomas. Si reaccionas, paras y anotas tu umbral.' },
    fr: { q: 'Comment fonctionne un test d\'un seul FODMAP ?', a: 'Tu choisis un aliment ne contenant qu\'un seul groupe de FODMAP — par exemple le lait pour le lactose. Tu manges une petite portion le jour 1, moyenne le jour 2, grande le jour 3, en gardant le reste de ton alimentation pauvre en FODMAP. Tu suis les symptômes. Si tu réagis, tu arrêtes et tu notes ton seuil.' },
    it: { q: 'Come funziona un test di un singolo FODMAP?', a: 'Scegli un alimento che contiene un solo gruppo FODMAP — per esempio il latte per il lattosio. Mangi una porzione piccola il giorno 1, media il giorno 2, grande il giorno 3, mantenendo il resto della dieta low-FODMAP. Monitori i sintomi. Se reagisci, ti fermi e annoti la tua soglia.' },
  },
  g23: {
    de: { q: 'In welcher Reihenfolge sollte ich die FODMAP-Gruppen testen?', a: 'Es gibt keine einzig richtige Reihenfolge, aber viele beginnen mit Laktose und Fruktose, weil sie oft besser vertragen werden, und gehen dann zu den Polyolen und Fruktanen über. Die App führt dich durch eine sinnvolle Abfolge. Eine Gruppe nach der anderen zu testen ist die Regel, die am wichtigsten ist.' },
    es: { q: '¿En qué orden debo probar los grupos FODMAP?', a: 'No hay un único orden obligatorio, pero muchas personas empiezan con lactosa y fructosa porque suelen tolerarse mejor, y luego pasan a los polioles y fructanos. La app te guía por una secuencia razonable. Probar un grupo cada vez es la regla que más importa.' },
    fr: { q: 'Dans quel ordre tester les groupes de FODMAP ?', a: 'Il n\'y a pas d\'ordre unique obligatoire, mais beaucoup commencent par le lactose et le fructose car ils sont souvent mieux tolérés, puis passent aux polyols et aux fructanes. L\'app te guide dans une séquence raisonnable. Tester un groupe à la fois est la règle qui compte le plus.' },
    it: { q: 'In che ordine devo testare i gruppi FODMAP?', a: 'Non c\'è un unico ordine obbligatorio, ma molti iniziano con lattosio e fruttosio perché spesso sono tollerati meglio, poi passano ai polioli e ai fruttani. L\'app ti guida in una sequenza ragionevole. Testare un gruppo alla volta è la regola che conta di più.' },
  },
  g24: {
    de: { q: 'Soll ich zwischen den Tests weiter FODMAP-arm essen?', a: 'Ja. Zwischen jeder Testung kehrst du für eine Ruhephase zur FODMAP-armen Ausgangslage zurück. So kann eine Reaktion abklingen, sodass der nächste Test mit einem sauberen Stand beginnt. Ohne Pause hintereinander zu testen macht die Ergebnisse unlesbar.' },
    es: { q: '¿Debo seguir comiendo bajo en FODMAP entre retos?', a: 'Sí. Entre cada reto vuelves a la base baja en FODMAP durante un periodo de descanso. Esto permite que cualquier reacción se calme para que la siguiente prueba empiece desde cero. Probar sin descanso, una tras otra, hace los resultados ilegibles.' },
    fr: { q: 'Dois-je continuer à manger pauvre en FODMAP entre les tests ?', a: 'Oui. Entre chaque test, tu reviens à la base pauvre en FODMAP pendant une période de repos. Cela laisse une réaction se calmer pour que le test suivant parte d\'une base propre. Tester sans repos, l\'un après l\'autre, rend les résultats illisibles.' },
    it: { q: 'Devo continuare a mangiare low-FODMAP tra un test e l\'altro?', a: 'Sì. Tra un test e l\'altro torni alla base low-FODMAP per un periodo di riposo. Questo lascia che una reazione si plachi, così il test successivo parte da una situazione pulita. Testare senza riposo, uno dopo l\'altro, rende i risultati illeggibili.' },
  },
  g25: {
    de: { q: 'Ich habe auf ein Lebensmittel reagiert. Darf ich es nie wieder essen?', a: 'Nicht unbedingt. Eine Reaktion zeigt deine aktuelle Schwelle, kein lebenslanges Urteil. Viele vertragen sogar von einem Lebensmittel, das in großer Menge durchfällt, eine kleine Portion. Und die Verträglichkeit kann sich mit der Zeit ändern — es lohnt sich, durchgefallene Lebensmittel alle paar Monate erneut zu testen.' },
    es: { q: 'He reaccionado a un alimento. ¿No puedo volver a comerlo nunca?', a: 'No necesariamente. Una reacción indica tu umbral actual, no una condena de por vida. Mucha gente tolera una porción pequeña incluso de un alimento que falla en cantidad grande. Y la tolerancia puede cambiar con el tiempo — vale la pena volver a probar los alimentos fallidos cada pocos meses.' },
    fr: { q: 'J\'ai réagi à un aliment. Ne puis-je plus jamais le manger ?', a: 'Pas forcément. Une réaction indique ton seuil actuel, pas une condamnation à vie. Beaucoup tolèrent une petite portion même d\'un aliment qui échoue en grande quantité. Et la tolérance peut évoluer avec le temps — il vaut la peine de retester les aliments échoués tous les quelques mois.' },
    it: { q: 'Ho reagito a un alimento. Non potrò mangiarlo mai più?', a: 'Non necessariamente. Una reazione indica la tua soglia attuale, non una condanna a vita. Molti tollerano una porzione piccola anche di un alimento che fallisce in grande quantità. E la tolleranza può cambiare nel tempo — vale la pena ritestare gli alimenti falliti ogni pochi mesi.' },
  },
  g26: {
    de: { q: 'Ich habe ein Lebensmittel im Test vertragen. Darf ich es jetzt frei essen?', a: 'Größtenteils ja, aber führe es schrittweise wieder ein, statt plötzlich täglich große Mengen zu essen. Achte außerdem auf Stacking — ein vertragenes Lebensmittel plus andere mittlere Lebensmittel in derselben Mahlzeit kann sich trotzdem summieren.' },
    es: { q: 'He tolerado un alimento en la prueba. ¿Puedo comerlo libremente ahora?', a: 'En su mayor parte sí, pero reintrodúcelo de forma gradual en lugar de comer de repente grandes cantidades a diario. Vigila también el efecto acumulativo — un alimento tolerado más otros moderados en la misma comida puede sumar igualmente.' },
    fr: { q: 'J\'ai toléré un aliment au test. Puis-je le manger librement maintenant ?', a: 'En grande partie oui, mais réintroduis-le progressivement plutôt que de manger soudainement de grandes quantités chaque jour. Surveille aussi l\'effet cumulatif — un aliment toléré plus d\'autres modérés dans le même repas peuvent quand même s\'additionner.' },
    it: { q: 'Ho tollerato un alimento nel test. Posso mangiarlo liberamente ora?', a: 'In gran parte sì, ma reintroducilo gradualmente invece di mangiarne improvvisamente grandi quantità ogni giorno. Fai attenzione anche all\'accumulo — un alimento tollerato più altri moderati nello stesso pasto possono comunque sommarsi.' },
  },
  g27: {
    de: { q: 'Wie lange dauert die gesamte Wiedereinführungsphase?', a: 'Normalerweise 6–10 Wochen, weil jede Testung 3 Tage plus eine Ruhephase dauert und es sechs FODMAP-Gruppen gibt. Es ist langsamer als die Eliminierung, aber es ist die Phase, die dir dauerhafte Freiheit gibt — die Geduld lohnt sich also.' },
    es: { q: '¿Cuánto dura toda la fase de reintroducción?', a: 'Normalmente de 6 a 10 semanas, porque cada reto dura 3 días más un periodo de descanso, y hay seis grupos FODMAP. Es más lenta que la eliminación, pero es la fase que te da libertad duradera, así que merece la paciencia.' },
    fr: { q: 'Combien de temps dure toute la phase de réintroduction ?', a: 'Généralement 6 à 10 semaines, car chaque test dure 3 jours plus une période de repos, et il y a six groupes de FODMAP. C\'est plus lent que l\'élimination, mais c\'est la phase qui te donne une liberté durable — la patience en vaut donc la peine.' },
    it: { q: 'Quanto dura tutta la fase di reintroduzione?', a: 'Di solito 6–10 settimane, perché ogni test dura 3 giorni più un periodo di riposo, e ci sono sei gruppi FODMAP. È più lenta dell\'eliminazione, ma è la fase che ti dà libertà duratura — quindi la pazienza vale la pena.' },
  },
  g28: {
    de: { q: 'Was, wenn meine Reaktion unklar ist — mild oder vielleicht nicht echt?', a: 'Das kommt vor. Notiere sie als nicht eindeutig und mach weiter; du kannst diese Gruppe später erneut testen. Zerbrich dir nicht den Kopf über ein Grenzergebnis. Wenn etwas wirklich ein Auslöser ist, wiederholt sich das Muster bei der Wiederholung meist deutlich.' },
    es: { q: '¿Y si mi reacción no está clara — leve o quizá no real?', a: 'Pasa. Anótala como no concluyente y sigue adelante; puedes volver a probar ese grupo más tarde. No te agobies por un resultado límite. Si algo es de verdad un desencadenante, el patrón suele repetirse con claridad al volver a probar.' },
    fr: { q: 'Et si ma réaction n\'est pas claire — légère ou peut-être pas réelle ?', a: 'Ça arrive. Note-la comme non concluante et passe à la suite ; tu pourras retester ce groupe plus tard. Ne te tracasse pas pour un résultat limite. Si quelque chose est vraiment un déclencheur, le schéma se répète généralement clairement au nouveau test.' },
    it: { q: 'E se la mia reazione non è chiara — lieve o forse non reale?', a: 'Capita. Annotala come non conclusiva e vai avanti; potrai ritestare quel gruppo più tardi. Non angosciarti per un risultato al limite. Se qualcosa è davvero un fattore scatenante, lo schema di solito si ripete chiaramente al nuovo test.' },
  },
  g29: {
    de: { q: 'Sollte ich die Tests während meiner Periode pausieren?', a: 'Viele entscheiden sich dafür. Hormonelle Schwankungen rund um die Menstruation können Darmsymptome um 30–40 % verstärken, was ein Lebensmittel wie einen Auslöser aussehen lassen kann, obwohl es eigentlich die Hormone sind. Tests in einem hormonell stabilen Zeitfenster liefern sauberere Ergebnisse.' },
    es: { q: '¿Debería pausar las pruebas durante la regla?', a: 'Muchas personas optan por hacerlo. Los cambios hormonales en torno a la menstruación pueden amplificar los síntomas intestinales un 30–40 %, lo que puede hacer que un alimento parezca un desencadenante cuando en realidad son las hormonas. Hacer pruebas en una ventana hormonalmente estable da resultados más limpios.' },
    fr: { q: 'Devrais-je suspendre les tests pendant mes règles ?', a: 'Beaucoup choisissent de le faire. Les variations hormonales autour des règles peuvent amplifier les symptômes intestinaux de 30 à 40 %, ce qui peut faire passer un aliment pour un déclencheur alors que ce sont les hormones. Tester dans une fenêtre hormonalement stable donne des résultats plus nets.' },
    it: { q: 'Dovrei sospendere i test durante il ciclo?', a: 'Molte persone scelgono di farlo. Le variazioni ormonali attorno alla mestruazione possono amplificare i sintomi intestinali del 30–40%, il che può far sembrare un alimento un fattore scatenante quando in realtà sono gli ormoni. Testare in una finestra ormonalmente stabile dà risultati più puliti.' },
  },
  g31: {
    de: { q: 'Welche Lebensmittel werden zum Testen jeder Gruppe verwendet?', a: 'Jeder Test nutzt ein Lebensmittel, das reich an nur einem FODMAP ist: Milch oder Joghurt für Laktose, Honig oder Mango für Fruktose, Apfel oder Birne für Sorbit, Pilze für Mannit, Linsen oder Kichererbsen für GOS, Brot oder Zwiebel für Fruktane. Die App gibt dir die Portionen für jeden.' },
    es: { q: '¿Qué alimentos se usan para probar cada grupo?', a: 'Cada prueba usa un alimento alto en un solo FODMAP: leche o yogur para la lactosa, miel o mango para la fructosa, manzana o pera para el sorbitol, setas para el manitol, lentejas o garbanzos para los GOS, pan o cebolla para los fructanos. La app te indica las porciones de cada uno.' },
    fr: { q: 'Quels aliments servent à tester chaque groupe ?', a: 'Chaque test utilise un aliment riche en un seul FODMAP : lait ou yaourt pour le lactose, miel ou mangue pour le fructose, pomme ou poire pour le sorbitol, champignons pour le mannitol, lentilles ou pois chiches pour les GOS, pain ou oignon pour les fructanes. L\'app te donne les portions pour chacun.' },
    it: { q: 'Quali alimenti si usano per testare ogni gruppo?', a: 'Ogni test usa un alimento ricco di un solo FODMAP: latte o yogurt per il lattosio, miele o mango per il fruttosio, mela o pera per il sorbitolo, funghi per il mannitolo, lenticchie o ceci per i GOS, pane o cipolla per i fruttani. L\'app ti indica le porzioni per ciascuno.' },
  },
  g32: {
    de: { q: 'Ich bin bei jeder Testung durchgefallen. Was nun?', a: 'Stelle zuerst sicher, dass deine Ausgangslage vor dem Testen wirklich ruhig war — während der Tests hochzukochen verursacht falsche Fehlschläge. Wenn die Ergebnisse dann immer noch alle negativ aussehen, ist das ein starkes Signal, mit einer Ernährungsfachkraft zu arbeiten, da es Nicht-FODMAP-Faktoren wie Stress, Motilität oder eine andere Erkrankung geben kann.' },
    es: { q: 'He fallado todos los retos. ¿Y ahora qué?', a: 'Primero, asegúrate de que tu base estaba realmente tranquila antes de probar — tener brotes durante las pruebas causa falsos fallos. Si los resultados siguen pareciendo todos negativos, es una señal fuerte para trabajar con un dietista, ya que puede haber factores no FODMAP como el estrés, la motilidad u otra afección.' },
    fr: { q: 'J\'ai échoué à tous les tests. Et maintenant ?', a: 'D\'abord, assure-toi que ta base était vraiment calme avant de tester — avoir des poussées pendant les tests provoque de faux échecs. Si les résultats semblent toujours tous négatifs, c\'est un signal fort pour travailler avec un diététicien, car il peut y avoir des facteurs non-FODMAP comme le stress, la motilité ou une autre affection.' },
    it: { q: 'Ho fallito tutti i test. E adesso?', a: 'Prima assicurati che la tua base fosse davvero calma prima di testare — avere riacutizzazioni durante i test causa falsi fallimenti. Se i risultati sembrano comunque tutti negativi, è un segnale forte per lavorare con un dietista, perché potrebbero esserci fattori non-FODMAP come stress, motilità o un\'altra condizione.' },
  },
  g33: {
    de: { q: 'Muss ich Lebensmittel später erneut testen?', a: 'Es ist eine gute Idee. Die Darmverträglichkeit ist nicht festgelegt — sie kann sich verbessern, wenn sich dein Darm beruhigt, oder sich über Jahre verschieben. Durchgefallene Gruppen alle paar Monate erneut zu testen kann deine sichere Liste langsam erweitern. Ein Auslöser von heute ist nicht zwangsläufig für immer einer.' },
    es: { q: '¿Necesito volver a probar alimentos más adelante?', a: 'Es buena idea. La tolerancia intestinal no es fija — puede mejorar a medida que tu intestino se calma, o cambiar a lo largo de los años. Volver a probar los grupos fallidos cada pocos meses puede ampliar poco a poco tu lista segura. Un desencadenante de hoy no lo es necesariamente para siempre.' },
    fr: { q: 'Dois-je retester des aliments plus tard ?', a: 'C\'est une bonne idée. La tolérance intestinale n\'est pas figée — elle peut s\'améliorer à mesure que ton intestin se calme, ou évoluer au fil des années. Retester les groupes échoués tous les quelques mois peut élargir peu à peu ta liste sûre. Un déclencheur d\'aujourd\'hui ne l\'est pas forcément pour toujours.' },
    it: { q: 'Devo ritestare gli alimenti più avanti?', a: 'È una buona idea. La tolleranza intestinale non è fissa — può migliorare man mano che l\'intestino si calma, o cambiare nel corso degli anni. Ritestare i gruppi falliti ogni pochi mesi può ampliare a poco a poco la tua lista sicura. Un fattore scatenante di oggi non lo è necessariamente per sempre.' },
  },
  // ── BATCH 4 — eating out, lifestyle, long-term. Pending native-speaker review. ──
  g34: {
    de: { q: 'Was ist im italienischen Restaurant in der Regel sicher?', a: 'Gegrilltes Fleisch oder Fisch, ein einfacher Rucola-Parmesan-Salat oder Pasta mit Olivenöl und Parmesan. Bitte um kein Zwiebel und keinen Knoblauch. Glutenfreie Pasta ist zunehmend verfügbar. Meide Sahnesoßen und alles auf einer schweren Zwiebel-Knoblauch-Soffritto-Basis.' },
    es: { q: '¿Qué suele ser seguro en un restaurante italiano?', a: 'Carne o pescado a la plancha, una ensalada sencilla de rúcula y parmesano, o pasta con aceite de oliva y parmesano. Pide sin cebolla ni ajo. La pasta sin gluten está cada vez más disponible. Evita las salsas con nata y todo lo que tenga una base pesada de sofrito de cebolla y ajo.' },
    fr: { q: 'Qu\'est-ce qui est généralement sûr dans un restaurant italien ?', a: 'Viande ou poisson grillés, une simple salade roquette-parmesan, ou des pâtes à l\'huile d\'olive et au parmesan. Demande sans oignon ni ail. Les pâtes sans gluten sont de plus en plus disponibles. Évite les sauces à la crème et tout ce qui repose sur une base lourde de soffritto oignon-ail.' },
    it: { q: 'Cosa è generalmente sicuro al ristorante italiano?', a: 'Carne o pesce grigliati, una semplice insalata di rucola e parmigiano, o pasta con olio d\'oliva e parmigiano. Chiedi senza cipolla e senza aglio. La pasta senza glutine è sempre più disponibile. Evita i sughi con panna e tutto ciò che ha una base pesante di soffritto di cipolla e aglio.' },
  },
  g35: {
    de: { q: 'Was ist im indischen Restaurant in der Regel sicher?', a: 'Einfacher Reis, Tandoori-Fleisch (in Joghurt mariniert, aber gegrillt, oft verträglich) und einfacher Dosa sind eher sicher. Der schwierige Teil: Die meisten Currys haben eine Zwiebel-Knoblauch-Basis, Naan ist Weizen, und Dal und Chana sind Hülsenfrüchte. Frag, ob ein Gericht ohne Zwiebel und Knoblauch zubereitet werden kann.' },
    es: { q: '¿Qué suele ser seguro en un restaurante indio?', a: 'El arroz sencillo, las carnes tandoori (marinadas en yogur pero a la parrilla, a menudo se toleran) y el dosa simple suelen ser más seguros. Lo difícil: la mayoría de los curris tienen una base de cebolla y ajo, el naan es de trigo, y el dal y el chana son legumbres. Pregunta si un plato puede prepararse sin cebolla ni ajo.' },
    fr: { q: 'Qu\'est-ce qui est généralement sûr dans un restaurant indien ?', a: 'Le riz nature, les viandes tandoori (marinées au yaourt mais grillées, souvent tolérées) et le dosa nature sont plutôt sûrs. Le difficile : la plupart des currys ont une base oignon-ail, le naan est au blé, et le dal et le chana sont des légumineuses. Demande si un plat peut être préparé sans oignon ni ail.' },
    it: { q: 'Cosa è generalmente sicuro al ristorante indiano?', a: 'Riso semplice, carni tandoori (marinate nello yogurt ma grigliate, spesso tollerate) e dosa semplice tendono a essere più sicuri. La parte difficile: la maggior parte dei curry ha una base di cipolla e aglio, il naan è di grano, e dal e chana sono legumi. Chiedi se un piatto può essere preparato senza cipolla e aglio.' },
  },
  g36: {
    de: { q: 'Was ist im chinesischen Restaurant in der Regel sicher?', a: 'Gedämpfter Reis, einfaches gedämpftes oder gegrilltes Eiweiß und einfach gebratenes Grüngemüse wie Pak Choi. Die Herausforderung: Zwiebel, Knoblauch und Soßen auf Weizenbasis sind überall, und Sojasoße ist in kleinen Mengen meist in Ordnung. Bitte um Gerichte ohne Zwiebel und Knoblauch, Soße sparsam.' },
    es: { q: '¿Qué suele ser seguro en un restaurante chino?', a: 'Arroz al vapor, proteína sencilla al vapor o a la parrilla, y verduras de hoja salteadas sencillas como el pak choi. El reto: la cebolla, el ajo y las salsas a base de trigo están por todas partes, y la salsa de soja en pequeñas cantidades suele estar bien. Pide platos cocinados sin cebolla ni ajo, con poca salsa.' },
    fr: { q: 'Qu\'est-ce qui est généralement sûr dans un restaurant chinois ?', a: 'Riz vapeur, protéine simple vapeur ou grillée, et légumes verts sautés simples comme le pak-choï. Le défi : oignon, ail et sauces à base de blé sont partout, et la sauce soja en petite quantité est généralement acceptable. Demande des plats cuisinés sans oignon ni ail, peu de sauce.' },
    it: { q: 'Cosa è generalmente sicuro al ristorante cinese?', a: 'Riso al vapore, proteine semplici al vapore o grigliate, e verdure a foglia saltate semplici come il pak choi. La sfida: cipolla, aglio e salse a base di grano sono ovunque, e la salsa di soia in piccole quantità di solito va bene. Chiedi piatti cucinati senza cipolla e aglio, con poca salsa.' },
  },
  g37: {
    de: { q: 'Was ist in einem amerikanischen oder Burger-Lokal sicher?', a: 'Ein Burger-Patty ohne Brötchen oder mit glutenfreiem Brötchen, dazu einfache Pommes (meist FODMAP-arm) und ein einfacher Beilagensalat ohne Dressing. Meide das normale Brötchen, Zwiebel, BBQ-Soße und Zwiebelringe. Einfaches gegrilltes Hähnchen ist eine verlässliche Rückfalloption.' },
    es: { q: '¿Qué es seguro en un sitio americano o de hamburguesas?', a: 'Una hamburguesa sin pan, o con pan sin gluten, más patatas fritas sencillas (normalmente bajas en FODMAP) y una ensalada de acompañamiento sencilla sin aliño. Evita el pan normal, la cebolla, la salsa BBQ y los aros de cebolla. El pollo a la parrilla sencillo es una opción de reserva fiable.' },
    fr: { q: 'Qu\'est-ce qui est sûr dans un fast-food américain ou un burger ?', a: 'Un steak haché sans pain, ou avec pain sans gluten, plus des frites simples (généralement pauvres en FODMAP) et une petite salade sans assaisonnement. Évite le pain classique, l\'oignon, la sauce BBQ et les rondelles d\'oignon. Le poulet grillé simple est une valeur sûre de repli.' },
    it: { q: 'Cosa è sicuro in un locale americano o di hamburger?', a: 'Un hamburger senza panino, o con panino senza glutine, più patatine semplici (di solito povere di FODMAP) e un\'insalata di contorno semplice senza condimento. Evita il panino normale, la cipolla, la salsa BBQ e gli anelli di cipolla. Il pollo grigliato semplice è un ripiego affidabile.' },
  },
  g38: {
    de: { q: 'Wie frage ich nach Zutaten, ohne dass es unangenehm wird?', a: 'Halte es kurz und formuliere es als medizinische Notwendigkeit: „Ich habe eine Verdauungserkrankung — kann das ohne Zwiebel und Knoblauch zubereitet werden?" Die meisten Küchen gehen damit routiniert um. Es als medizinische Anforderung zu nennen wird ernster genommen als eine Vorliebe.' },
    es: { q: '¿Cómo pregunto por los ingredientes sin que resulte incómodo?', a: 'Hazlo breve y plantéalo como una necesidad médica: «Tengo una afección digestiva, ¿pueden preparar esto sin cebolla ni ajo?». La mayoría de las cocinas lo gestionan con normalidad. Llamarlo un requisito médico se toma más en serio que llamarlo una preferencia.' },
    fr: { q: 'Comment demander les ingrédients sans que ce soit gênant ?', a: 'Fais court et présente-le comme une nécessité médicale : « J\'ai un trouble digestif — peut-on préparer ce plat sans oignon ni ail ? » La plupart des cuisines gèrent cela couramment. Le présenter comme une exigence médicale est pris plus au sérieux qu\'une préférence.' },
    it: { q: 'Come chiedo degli ingredienti senza che sia imbarazzante?', a: 'Falla breve e presentala come una necessità medica: "Ho un disturbo digestivo — si può preparare senza cipolla e aglio?". La maggior parte delle cucine lo gestisce di routine. Definirla un\'esigenza medica viene preso più sul serio che chiamarla una preferenza.' },
  },
  g39: {
    de: { q: 'Auf welche versteckten FODMAPs sollte ich beim Auswärtsessen achten?', a: 'Zwiebel und Knoblauch in fast jeder Soße, Brühe und jedem Dressing; Weizen als Bindemittel in Bratensoßen und Suppen; fruktosereiche Zutaten in Marinaden und Glasuren; und große Portionen, die ein mittleres Lebensmittel hoch machen. Im Zweifel wähle einfach zubereitete Gerichte.' },
    es: { q: '¿Qué FODMAP ocultos debo vigilar al comer fuera?', a: 'Cebolla y ajo en casi todas las salsas, caldos y aliños; trigo como espesante en salsas de carne y sopas; ingredientes altos en fructosa en marinados y glaseados; y porciones grandes que convierten un alimento moderado en alto. Ante la duda, elige platos de preparación sencilla.' },
    fr: { q: 'Quels FODMAP cachés surveiller en mangeant dehors ?', a: 'Oignon et ail dans presque toutes les sauces, bouillons et vinaigrettes ; blé comme épaississant dans les sauces et les soupes ; ingrédients riches en fructose dans les marinades et les glaçages ; et grandes portions qui rendent un aliment modéré élevé. Dans le doute, choisis des plats préparés simplement.' },
    it: { q: 'A quali FODMAP nascosti devo fare attenzione mangiando fuori?', a: 'Cipolla e aglio in quasi ogni salsa, brodo e condimento; grano come addensante in sughi e zuppe; ingredienti ricchi di fruttosio in marinate e glasse; e porzioni grandi che rendono alto un alimento moderato. Nel dubbio, scegli piatti preparati in modo semplice.' },
  },
  g40: {
    de: { q: 'Soll ich einfach vorher essen, bevor ich ausgehe?', a: 'Es ist eine sinnvolle Strategie für schwierige Anlässe — iss vorher eine sichere Mahlzeit, dann nimm im Restaurant etwas Kleines und risikoarmes. Das nimmt den Druck. Aber langfristig ist das Ziel der Wiedereinführung, zu erweitern, was du bestellen kannst — nutze das also als Brücke, nicht als Dauerlösung.' },
    es: { q: '¿Debería comer antes de salir?', a: 'Es una estrategia válida para eventos complicados — come una comida segura antes y luego toma algo pequeño y de bajo riesgo en el restaurante. Quita presión. Pero a largo plazo el objetivo de la reintroducción es ampliar lo que puedes pedir, así que úsalo como un puente, no como un plan permanente.' },
    fr: { q: 'Devrais-je simplement manger avant de sortir ?', a: 'C\'est une stratégie valable pour les occasions difficiles — mange un repas sûr avant, puis prends quelque chose de petit et peu risqué au restaurant. Ça enlève la pression. Mais à long terme, le but de la réintroduction est d\'élargir ce que tu peux commander — utilise donc cela comme un pont, pas comme un plan permanent.' },
    it: { q: 'Dovrei semplicemente mangiare prima di uscire?', a: 'È una strategia valida per le occasioni difficili — mangia un pasto sicuro prima, poi prendi qualcosa di piccolo e a basso rischio al ristorante. Toglie la pressione. Ma a lungo termine lo scopo della reintroduzione è ampliare ciò che puoi ordinare — quindi usalo come ponte, non come piano permanente.' },
  },
  g42: {
    de: { q: 'Beeinflusst schlechter Schlaf meinen Darm?', a: 'Ja. Schlechter oder kurzer Schlaf hängt mit schlimmeren Reizdarm-Symptomen am nächsten Tag zusammen, teils über Stresshormone, teils über die Darm-Hirn-Achse. Wenn die App zeigt, dass deine schlechten Tage auf kurze Nächte folgen, ist das ein echtes und häufiges Muster.' },
    es: { q: '¿El mal sueño afecta a mi intestino?', a: 'Sí. Dormir mal o poco se relaciona con peores síntomas de SII al día siguiente, en parte por las hormonas del estrés y en parte por el eje intestino-cerebro. Si la app muestra que tus días malos siguen a noches cortas, es un patrón real y común.' },
    fr: { q: 'Un mauvais sommeil affecte-t-il mon intestin ?', a: 'Oui. Un sommeil mauvais ou court est lié à des symptômes de SII plus marqués le lendemain, en partie via les hormones du stress, en partie via l\'axe intestin-cerveau. Si l\'app montre que tes mauvais jours suivent des nuits courtes, c\'est un schéma réel et courant.' },
    it: { q: 'Il sonno scarso influisce sul mio intestino?', a: 'Sì. Dormire male o poco è collegato a sintomi di colon irritabile peggiori il giorno dopo, in parte tramite gli ormoni dello stress, in parte tramite l\'asse intestino-cervello. Se l\'app mostra che le tue giornate brutte seguono notti corte, è uno schema reale e comune.' },
  },
  g43: {
    de: { q: 'Kann mein Menstruationszyklus meine Symptome verändern?', a: 'Ja. Viele bemerken rund um ihre Periode stärkere Blähungen, Schmerzen und veränderten Stuhlgang. Hormonelle Schwankungen können Darmsymptome um 30–40 % verstärken. Den Zyklus zusammen mit den Symptomen zu verfolgen hilft, hormonbedingte von ernährungsbedingten Tagen zu trennen.' },
    es: { q: '¿Puede mi ciclo menstrual cambiar mis síntomas?', a: 'Sí. Muchas personas notan más hinchazón, dolor y cambios en las deposiciones alrededor de la regla. Los cambios hormonales pueden amplificar los síntomas intestinales un 30–40 %. Seguir tu ciclo junto con los síntomas ayuda a separar los días hormonales de los días por alimentos.' },
    fr: { q: 'Mon cycle menstruel peut-il modifier mes symptômes ?', a: 'Oui. Beaucoup remarquent davantage de ballonnements, de douleurs et de changements du transit autour des règles. Les variations hormonales peuvent amplifier les symptômes intestinaux de 30 à 40 %. Suivre ton cycle en même temps que les symptômes aide à distinguer les jours hormonaux des jours liés à l\'alimentation.' },
    it: { q: 'Il ciclo mestruale può cambiare i miei sintomi?', a: 'Sì. Molte persone notano più gonfiore, dolore e alterazioni intestinali attorno al ciclo. Le variazioni ormonali possono amplificare i sintomi intestinali del 30–40%. Seguire il ciclo insieme ai sintomi aiuta a distinguere i giorni ormonali da quelli legati al cibo.' },
  },
  g44: {
    de: { q: 'Hilft oder schadet Bewegung bei Reizdarm?', a: 'Regelmäßige moderate Bewegung hilft im Allgemeinen — sie unterstützt eine gesunde Darmbewegung und reduziert Stress. Sehr intensiver Ausdauersport kann manchmal Symptome auslösen. Sanfte, gleichmäßige Bewegung wie Gehen oder Yoga wird von den meisten gut vertragen und ist förderlich.' },
    es: { q: '¿El ejercicio ayuda o perjudica al SII?', a: 'El ejercicio moderado y regular suele ayudar — favorece una motilidad intestinal sana y reduce el estrés. El ejercicio de resistencia muy intenso a veces puede provocar síntomas. El movimiento suave y constante, como caminar o el yoga, se tolera bien y es beneficioso para la mayoría.' },
    fr: { q: 'L\'exercice aide-t-il ou nuit-il au SII ?', a: 'Un exercice modéré et régulier aide généralement — il favorise un bon transit et réduit le stress. Un exercice d\'endurance très intense peut parfois déclencher des symptômes. Un mouvement doux et régulier comme la marche ou le yoga est bien toléré et bénéfique pour la plupart.' },
    it: { q: 'L\'esercizio aiuta o danneggia il colon irritabile?', a: 'L\'esercizio moderato e regolare in genere aiuta — favorisce una sana motilità intestinale e riduce lo stress. L\'esercizio di resistenza molto intenso a volte può scatenare sintomi. Il movimento dolce e costante come camminare o lo yoga è ben tollerato e benefico per la maggior parte.' },
  },
  g45: {
    de: { q: 'Wie schnell nach dem Essen treten FODMAP-Symptome auf?', a: 'Das ist unterschiedlich. Manche Symptome treten innerhalb von 1–2 Stunden auf, wenn das Essen den Dünndarm erreicht; Gas und Blähungen durch Gärung erreichen ihren Höhepunkt oft 4–8 Stunden später, wenn das Essen den Dickdarm erreicht. Diese Verzögerung ist der Grund, warum ein Ernährungstagebuch mit Uhrzeiten so nützlich ist — der Übeltäter ist oft eine frühere Mahlzeit.' },
    es: { q: '¿Cuánto tardan en aparecer los síntomas FODMAP tras comer?', a: 'Varía. Algunos síntomas aparecen en 1–2 horas, cuando la comida llega al intestino delgado; el gas y la hinchazón por fermentación suelen alcanzar su punto máximo 4–8 horas después, cuando la comida llega al intestino grueso. Ese retraso es la razón por la que un diario de comidas con horas es tan útil — el culpable suele ser una comida anterior.' },
    fr: { q: 'Combien de temps après le repas les symptômes FODMAP apparaissent-ils ?', a: 'Cela varie. Certains symptômes apparaissent en 1 à 2 heures, quand les aliments atteignent l\'intestin grêle ; les gaz et ballonnements dus à la fermentation culminent souvent 4 à 8 heures plus tard, quand les aliments atteignent le gros intestin. Ce délai explique pourquoi un journal alimentaire avec les heures est si utile — le coupable est souvent un repas antérieur.' },
    it: { q: 'Quanto tempo dopo aver mangiato compaiono i sintomi FODMAP?', a: 'Varia. Alcuni sintomi compaiono entro 1–2 ore, quando il cibo raggiunge l\'intestino tenue; gas e gonfiore da fermentazione spesso raggiungono il picco 4–8 ore dopo, quando il cibo raggiunge l\'intestino crasso. Questo ritardo è il motivo per cui un diario alimentare con gli orari è così utile — il colpevole è spesso un pasto precedente.' },
  },
  g46: {
    de: { q: 'Warum blähe ich auf, selbst wenn ich vorsichtig esse?', a: 'Blähungen hängen nicht immer mit FODMAPs zusammen. Stress, verschluckte Luft, schnelles Essen, große Mahlzeitsmengen, hormonelle Zyklen und die Darmbewegung tragen alle dazu bei. Wenn dein Tagebuch Blähungen ohne klaren Lebensmittelbezug zeigt, schau dir diese anderen Faktoren an.' },
    es: { q: '¿Por qué me hincho aunque coma con cuidado?', a: 'La hinchazón no siempre tiene que ver con los FODMAP. El estrés, el aire tragado, comer deprisa, los grandes volúmenes de comida, los ciclos hormonales y la motilidad intestinal contribuyen todos. Si tu diario muestra hinchazón sin una relación clara con un alimento, fíjate en estos otros factores.' },
    fr: { q: 'Pourquoi ai-je des ballonnements même en mangeant prudemment ?', a: 'Les ballonnements ne sont pas toujours liés aux FODMAP. Le stress, l\'air avalé, manger vite, les gros volumes de repas, les cycles hormonaux et la motilité intestinale y contribuent tous. Si ton journal montre des ballonnements sans lien clair avec un aliment, regarde ces autres facteurs.' },
    it: { q: 'Perché mi gonfio anche se mangio con attenzione?', a: 'Il gonfiore non è sempre legato ai FODMAP. Stress, aria ingerita, mangiare in fretta, pasti molto abbondanti, cicli ormonali e motilità intestinale contribuiscono tutti. Se il tuo diario mostra gonfiore senza un chiaro legame con un alimento, guarda questi altri fattori.' },
  },
  g47: {
    de: { q: 'Was passiert, nachdem ich die Wiedereinführung abgeschlossen habe?', a: 'Du gehst in die personalisierte Erhaltungsphase über: Du isst so abwechslungsreich wie möglich und schränkst nur die bestimmten FODMAPs und Portionen ein, die dich tatsächlich auslösen. Das ist das Ziel des gesamten Prozesses — die am wenigsten einschränkende Ernährung, die dich beschwerdefrei hält.' },
    es: { q: '¿Qué pasa después de terminar la reintroducción?', a: 'Pasas a la fase de mantenimiento personalizada: comes lo más variado posible y solo limitas los FODMAP y las porciones concretas que de verdad te desencadenan. Ese es el objetivo de todo el proceso — la dieta menos restrictiva que te mantenga cómodo.' },
    fr: { q: 'Que se passe-t-il après la fin de la réintroduction ?', a: 'Tu passes à la phase de maintien personnalisée : tu manges le plus varié possible et ne limites que les FODMAP et les portions précis qui te déclenchent vraiment. C\'est l\'objectif de tout le processus — l\'alimentation la moins restrictive qui te garde à l\'aise.' },
    it: { q: 'Cosa succede dopo aver completato la reintroduzione?', a: 'Passi alla fase di mantenimento personalizzata: mangi il più vario possibile e limiti solo i FODMAP e le porzioni specifici che ti scatenano davvero i sintomi. Questo è l\'obiettivo di tutto il percorso — la dieta meno restrittiva che ti mantiene senza disturbi.' },
  },
  g48: {
    de: { q: 'Ist es schlecht, für immer streng FODMAP-arm zu bleiben?', a: 'Ja, es wird nicht empfohlen. Langfristige strenge Einschränkung kann die Vielfalt deiner Darmbakterien verringern, was für die Darmgesundheit wichtig ist, und erhöht das Risiko von Nährstofflücken. Die Wiedereinführung existiert genau deshalb, damit du nicht streng bleiben musst.' },
    es: { q: '¿Es malo quedarse estrictamente bajo en FODMAP para siempre?', a: 'Sí, no se recomienda. La restricción estricta a largo plazo puede reducir la diversidad de tu flora intestinal, que es importante para la salud intestinal, y aumenta el riesgo de carencias nutricionales. La reintroducción existe precisamente para que no tengas que mantenerte estricto.' },
    fr: { q: 'Est-ce mauvais de rester strictement pauvre en FODMAP pour toujours ?', a: 'Oui, ce n\'est pas recommandé. Une restriction stricte à long terme peut réduire la diversité de ta flore intestinale, importante pour la santé intestinale, et augmente le risque de carences. La réintroduction existe précisément pour que tu n\'aies pas à rester strict.' },
    it: { q: 'È dannoso restare rigorosamente low-FODMAP per sempre?', a: 'Sì, non è raccomandato. Una restrizione rigorosa a lungo termine può ridurre la diversità dei tuoi batteri intestinali, importante per la salute dell\'intestino, e aumenta il rischio di carenze nutrizionali. La reintroduzione esiste proprio perché tu non debba restare rigoroso.' },
  },
  g49: {
    de: { q: 'Meine Auslöser scheinen sich mit der Zeit geändert zu haben. Ist das normal?', a: 'Ja, völlig. Die Darmverträglichkeit ist dynamisch — sie verschiebt sich mit Stress, Lebensphase, Darmgesundheit und Zeit. Deshalb lohnt es sich, alte Auslöser regelmäßig erneut zu testen; Lebensmittel, die vor einem Jahr durchgefallen sind, können jetzt in Ordnung sein.' },
    es: { q: 'Mis desencadenantes parecen haber cambiado con el tiempo. ¿Es normal?', a: 'Sí, completamente. La tolerancia intestinal es dinámica — cambia con el estrés, la etapa de la vida, la salud intestinal y el tiempo. Por eso vale la pena volver a probar los desencadenantes antiguos de forma periódica; los alimentos que fallaron hace un año pueden estar bien ahora.' },
    fr: { q: 'Mes déclencheurs semblent avoir changé avec le temps. Est-ce normal ?', a: 'Oui, tout à fait. La tolérance intestinale est dynamique — elle évolue avec le stress, l\'étape de la vie, la santé intestinale et le temps. C\'est pourquoi il vaut la peine de retester périodiquement les anciens déclencheurs ; des aliments qui ont échoué il y a un an peuvent convenir maintenant.' },
    it: { q: 'I miei fattori scatenanti sembrano cambiati nel tempo. È normale?', a: 'Sì, del tutto. La tolleranza intestinale è dinamica — cambia con lo stress, la fase della vita, la salute dell\'intestino e il tempo. Per questo vale la pena ritestare periodicamente i vecchi fattori scatenanti; alimenti falliti un anno fa possono andare bene adesso.' },
  },
  g50: {
    de: { q: 'Kann mein Reizdarm jemals ganz verschwinden?', a: 'Reizdarm ist eine chronische Erkrankung, daher ist es treffender, in Begriffen guter Bewältigung statt einer Heilung zu denken. Dennoch erreichen viele einen Punkt, an dem die Symptome mild, selten und gut kontrolliert sind und die Ernährung sich fast normal anfühlt. Dieser stabile, lebbare Zustand ist ein realistisches Ziel.' },
    es: { q: '¿Puede mi SII desaparecer por completo alguna vez?', a: 'El SII es una afección crónica, así que es más exacto pensar en términos de buena gestión en lugar de cura. Dicho esto, muchas personas llegan a un punto en el que los síntomas son leves, poco frecuentes y bien controlados, y la dieta se siente casi normal. Ese estado estable y llevadero es un objetivo realista.' },
    fr: { q: 'Mon SII peut-il un jour disparaître complètement ?', a: 'Le SII est une affection chronique, il est donc plus juste de penser en termes de bonne gestion plutôt que de guérison. Cela dit, beaucoup atteignent un point où les symptômes sont légers, peu fréquents et bien contrôlés, et où l\'alimentation semble presque normale. Cet état stable et vivable est un objectif réaliste.' },
    it: { q: 'Il mio colon irritabile può sparire del tutto?', a: 'Il colon irritabile è una condizione cronica, quindi è più corretto pensare in termini di buona gestione invece che di cura. Detto questo, molte persone raggiungono un punto in cui i sintomi sono lievi, poco frequenti e ben controllati, e la dieta sembra quasi normale. Questo stato stabile e sostenibile è un obiettivo realistico.' },
  },
};

// Returns the localized { q, a } for a guide item, falling back to English.
function guideText(item, lang) {
  if (!lang || lang === 'en') return { q: item.q, a: item.a };
  const tr = GUIDE_I18N[item.id] && GUIDE_I18N[item.id][lang];
  return {
    q: (tr && tr.q) ? tr.q : item.q,
    a: (tr && tr.a) ? tr.a : item.a,
  };
}

// Localized labels for GutGuide topic filter chips.
const GUIDE_TOPIC_LABELS = {
  all:       { de: 'Alle', es: 'Todos', fr: 'Tous', it: 'Tutti' },
  basics:    { de: 'FODMAP-Grundlagen', es: 'Conceptos FODMAP', fr: 'Bases FODMAP', it: 'Basi FODMAP' },
  elimination:{ de: 'Eliminierung', es: 'Eliminación', fr: 'Élimination', it: 'Eliminazione' },
  reintro:   { de: 'Wiedereinführung', es: 'Reintroducción', fr: 'Réintroduction', it: 'Reintroduzione' },
  eatingout: { de: 'Auswärts essen', es: 'Comer fuera', fr: 'Manger dehors', it: 'Mangiare fuori' },
  lifestyle: { de: 'Symptome & Leben', es: 'Síntomas y vida', fr: 'Symptômes & vie', it: 'Sintomi e vita' },
  longterm:  { de: 'Langfristig', es: 'A largo plazo', fr: 'Long terme', it: 'Lungo termine' },
};
function guideTopicLabel(topic, fallback, lang) {
  if (!lang || lang === 'en') return fallback;
  const tr = GUIDE_TOPIC_LABELS[topic];
  return (tr && tr[lang]) ? tr[lang] : fallback;
}

// Per-food fermentation notes. Fermentation lowers FODMAPs but often RAISES histamine,
// so each note is specific and honest — sometimes encouraging, sometimes a caution.
// tone: 'positive' | 'mixed' | 'caution'. histamineFlag: true if fermentation raises histamine here.
const FERMENTATION_NOTES = {
  kefir: {
    tone: 'mixed',
    histamineFlag: true,
    text: 'Fermentation breaks down much of the lactose, so some people tolerate kefir better than plain milk — worth testing your own limit during reintroduction.',
    histamineText: 'Because you flagged histamine sensitivity: note that the same fermentation also makes kefir high in histamine, which may matter more for you than the lactose.',
  },
  yogurt: {
    tone: 'mixed',
    histamineFlag: true,
    text: 'Live-culture yogurt is partly fermented, so its lactose is a little lower than milk. Lactose-free yogurt is still the safer bet during elimination.',
    histamineText: 'Note for histamine sensitivity: fermented and aged dairy tends to be high in histamine.',
  },
  greek_yogurt: {
    tone: 'mixed',
    histamineFlag: true,
    text: 'Greek yogurt is strained, which removes much of the lactose-rich whey — so it usually has less lactose than regular yogurt and is often tolerated in smaller portions. Test your own limit during reintroduction.',
    histamineText: 'Note for histamine sensitivity: straining lowers the lactose, but fermented dairy stays high in histamine.',
  },
  skyr: {
    tone: 'mixed',
    histamineFlag: true,
    text: 'Skyr is a strained, cultured dairy — removing the lactose-rich whey leaves it lower in lactose than regular yogurt, so modest portions are often gentler. Find your own limit during reintroduction.',
    histamineText: 'Note for histamine sensitivity: less lactose thanks to straining, but as fermented dairy it stays high in histamine.',
  },
  sourdough_spelt: {
    tone: 'positive',
    histamineFlag: false,
    text: 'Traditional sourdough fermentation lets bacteria consume most of the fructans in the flour. This is why spelt sourdough is usually tolerated even when normal bread is not — give it a normal-sized portion and see.',
  },
  pizza_dough: {
    tone: 'mixed',
    histamineFlag: false,
    text: 'Fermentation time matters here: a long, slow cold-proof (24-72h, as with traditional Neapolitan or artisan sourdough pizza) can break down a good share of the flour\'s fructans, similar to sourdough bread. Most everyday pizza dough only gets a quick 1-2 hour yeast rise and won\'t see that benefit — treat a normal pizza as high-FODMAP unless you know the dough was long-fermented.',
  },
  pizza: {
    tone: 'mixed',
    histamineFlag: false,
    text: 'Fermentation time matters here: a long, slow cold-proof (24-72h, as with traditional Neapolitan or artisan sourdough pizza) can break down a good share of the flour\'s fructans, similar to sourdough bread. Most everyday pizza dough only gets a quick 1-2 hour yeast rise and won\'t see that benefit — treat a normal pizza as high-FODMAP unless you know the dough was long-fermented.',
  },
  sauerkraut: {
    tone: 'mixed',
    histamineFlag: true,
    text: 'A small portion (about 40g / 2 tbsp) is low enough in FODMAPs for most people — it is larger servings that push the fructans and mannitol too high. Keep it as a side, not a main.',
    histamineText: 'With your histamine sensitivity flagged, note that fermentation also makes sauerkraut very high in histamine — that may matter more for you than the FODMAPs, even in a small portion.',
  },
  kimchi: {
    tone: 'mixed',
    histamineFlag: true,
    text: 'A small portion (about 40g / 2 tbsp) is usually fine — it is larger servings, plus the garlic and onion kimchi is made with, that push the fructans too high. Keep it as a condiment, not a main.',
    histamineText: 'With your histamine sensitivity flagged, note that fermentation also makes kimchi very high in histamine — that may matter more for you than the FODMAPs, even in a small portion.',
  },
  cheddar: {
    tone: 'positive',
    histamineFlag: true,
    text: 'Hard aged cheeses like cheddar are very low in lactose — the aging process breaks it down — so they are low-FODMAP in normal portions.',
    histamineText: 'For histamine sensitivity though: the longer a cheese is aged, the higher its histamine. Aged cheeses are a common histamine trigger.',
  },
  parmesan: {
    tone: 'positive',
    histamineFlag: true,
    text: 'Parmesan is aged long enough that almost no lactose remains — it is low-FODMAP in normal servings.',
    histamineText: 'For histamine sensitivity: long-aged cheeses like parmesan are among the highest-histamine foods.',
  },
  salami: {
    tone: 'caution',
    histamineFlag: false,
    text: 'Salami varies a lot: many are made with garlic and onion (high in fructans). Plain salami is low-FODMAP, but check the label — or test your own tolerance with a small amount.',
  },
};

// Low-FODMAP swaps shown on a high/moderate food's detail page.
// Keyed by food id. Each swap: what to use instead + why it works.
const LOW_FODMAP_SWAPS = {
  risotto: [
    { name: 'Skip the onion, use spring-onion greens', why: 'Onion is the main reason risotto is high-FODMAP. The green tops of spring onion give the same base flavour without the fructans.' },
    { name: 'Garlic-infused oil instead of garlic', why: 'Fructans are not oil-soluble, so the oil carries the taste but not the FODMAPs.' },
    { name: 'Low-FODMAP or homemade stock', why: 'Most stock cubes contain onion and garlic. A plain or certified low-FODMAP stock avoids them.' },
    { name: 'Parmesan up to about 40g', why: 'Aged parmesan has almost no lactose and is low-FODMAP in this amount. The rice itself is already low-FODMAP, so a carefully made risotto can be low or moderate.' },
  ],
  onion: [
    { name: 'Green tops of spring onions', why: 'The green part is low-FODMAP — only the white bulb is high. Gives the same fresh onion flavour.' },
    { name: 'Chives', why: 'Adds a mild onion taste with no fructans.' },
    { name: 'Asafoetida (a pinch)', why: 'A spice used in Indian cooking that mimics onion-garlic depth.' },
  ],
  shallot: [
    { name: 'Green tops of spring onions', why: 'Same flavour direction, no fructans in the green part.' },
    { name: 'Chives', why: 'Mild allium taste without the high-FODMAP bulb.' },
  ],
  leek: [
    { name: 'Leek leaves (green part only)', why: 'Like spring onions, the green leaves are low-FODMAP — only the white base is high.' },
    { name: 'Chives', why: 'A safe way to keep the allium note.' },
  ],
  garlic: [
    { name: 'Garlic-infused oil', why: 'Fructans are not oil-soluble, so the oil carries the flavour but not the FODMAPs. The single best garlic swap.' },
    { name: 'Garlic-infused olive oil (homemade)', why: 'Gently warm garlic cloves in oil, then remove them. Flavour stays, fructans do not.' },
    { name: 'A pinch of asafoetida', why: 'Brings savoury allium depth to curries and stews.' },
  ],
  bread: [
    { name: 'Sourdough spelt bread', why: 'Long fermentation breaks down most fructans — usually tolerated in normal portions.' },
    { name: 'Gluten-free bread', why: 'Made without wheat, so no wheat fructans.' },
  ],
  rye_bread: [
    { name: 'Sourdough spelt bread', why: 'Traditional sourdough fermentation lowers the fructan load.' },
    { name: 'Gluten-free bread', why: 'No wheat or rye fructans.' },
  ],
  brotchen: [
    { name: 'Gluten-free rolls', why: 'Same shape and use, without the wheat fructans.' },
    { name: 'Sourdough spelt roll', why: 'Fermentation makes spelt easier to tolerate than standard wheat.' },
  ],
  whole_wheat_bread: [
    { name: 'Sourdough spelt bread', why: 'Lower fructan load thanks to fermentation.' },
    { name: 'Gluten-free wholegrain bread', why: 'Wholegrain texture without wheat fructans.' },
  ],
  pasta: [
    { name: 'Gluten-free pasta', why: 'Rice or corn based — no wheat fructans, and texture is very close.' },
    { name: 'Rice noodles', why: 'Naturally low-FODMAP and great for Asian dishes.' },
  ],
  spatzle: [
    { name: 'Gluten-free pasta', why: 'Keeps a soft noodle texture without wheat fructans.' },
  ],
  milk: [
    { name: 'Lactose-free milk', why: 'Real milk with the lactose already broken down — tastes the same.' },
    { name: 'Almond milk', why: 'Naturally lactose-free; good in coffee and cereal.' },
    { name: 'Rice milk', why: 'A mild, lactose-free option.' },
  ],
  yogurt: [
    { name: 'Lactose-free yogurt', why: 'Same creamy yogurt, lactose pre-digested.' },
  ],
  kefir: [
    { name: 'Lactose-free yogurt', why: 'A cultured, lactose-free alternative.' },
  ],
  apple: [
    { name: 'Orange or kiwi', why: 'Low-FODMAP fruit with the same fresh, crunchy or juicy appeal.' },
    { name: 'Firm banana', why: 'Naturally low-FODMAP when not overripe.' },
  ],
  pear: [
    { name: 'Kiwi', why: 'Sweet and juicy, but low-FODMAP.' },
    { name: 'Orange', why: 'No excess fructose or sorbitol.' },
  ],
  honey: [
    { name: 'Maple syrup', why: 'Naturally low-FODMAP — no excess fructose.' },
    { name: 'Table sugar (in moderation)', why: 'Plain sucrose is low-FODMAP in normal amounts.' },
  ],
  agave: [
    { name: 'Maple syrup', why: 'A low-FODMAP liquid sweetener.' },
  ],
  pasta_sauce: [
    { name: 'Homemade sauce with canned tomato + garlic oil', why: 'Skip the onion and garlic; use garlic-infused oil and herbs instead.' },
    { name: 'Basil pesto', why: 'A low-FODMAP sauce when used in normal portions.' },
  ],
  mushroom: [
    { name: 'Oyster mushrooms (small portion)', why: 'Lower in mannitol than common button mushrooms.' },
    { name: 'Canned champignons (drained)', why: 'Canning reduces the mannitol — a small portion is usually tolerated.' },
  ],
  cauliflower: [
    { name: 'Broccoli heads (small portion)', why: 'Low-FODMAP in modest servings, similar role in cooking.' },
  ],
  cashews: [
    { name: 'Walnuts or peanuts', why: 'Low-FODMAP nuts with no GOS in normal portions.' },
    { name: 'Pumpkin seeds', why: 'A safe, crunchy snack swap.' },
  ],
  kidney_beans: [
    { name: 'Canned lentils (small portion, well rinsed)', why: 'Canning and rinsing washes away much of the GOS.' },
    { name: 'Firm tofu', why: 'A low-FODMAP plant protein.' },
  ],
  hummus: [
    { name: 'Garlic-oil tofu dip', why: 'Blend silken tofu with garlic-infused oil and lemon — creamy, no GOS.' },
  ],
};

const REINTRO_ORDER = [
  { id: 'lactose', name: 'Lactose', emoji: '🥛' },
  { id: 'fructose', name: 'Fructose', emoji: '🍯' },
  { id: 'sorbitol', name: 'Sorbitol', emoji: '🍐' },
  { id: 'mannitol', name: 'Mannitol', emoji: '🍄' },
  { id: 'gos', name: 'GOS', emoji: '🫘' },
  { id: 'fructans', name: 'Fructans', emoji: '🍞' },
];

const TEST_FOODS_PER_CATEGORY = {
  lactose: [
    { id: 'milk', name: "Cow's milk", small: '60ml (¼ cup)', medium: '125ml (½ cup)', large: '250ml (1 cup)' },
    { id: 'yogurt', name: 'Regular yogurt', small: '40g (3 tbsp)', medium: '85g (½ cup)', large: '170g (1 cup)' },
  ],
  fructose: [
    { id: 'honey', name: 'Honey', small: '½ tsp', medium: '1 tsp', large: '1 tbsp' },
    { id: 'mango', name: 'Mango', small: '40g', medium: '80g', large: '160g' },
  ],
  sorbitol: [
    { id: 'apple', name: 'Apple', small: '¼ apple', medium: '½ apple', large: '1 apple' },
    { id: 'pear', name: 'Pear', small: '¼ pear', medium: '½ pear', large: '1 pear' },
  ],
  mannitol: [
    { id: 'mushroom', name: 'Mushrooms', small: '20g (¼ cup)', medium: '40g (½ cup)', large: '75g (1 cup)' },
    { id: 'cauliflower', name: 'Cauliflower', small: '30g (¼ cup)', medium: '60g (½ cup)', large: '120g (1 cup)' },
  ],
  gos: [
    { id: 'lentils', name: 'Lentils (cooked)', small: '23g (2 tbsp)', medium: '46g (¼ cup)', large: '90g (½ cup)' },
    { id: 'chickpeas', name: 'Chickpeas', small: '21g', medium: '42g', large: '84g' },
  ],
  fructans: [
    { id: 'bread', name: 'Wheat bread', small: '½ slice', medium: '1 slice', large: '2 slices' },
    { id: 'onion', name: 'Onion', small: '5g (1 tsp)', medium: '15g (1 tbsp)', large: '40g (¼ cup)' },
  ],
};

const REST_DAYS_BETWEEN_TESTS = 3;

function computeVerdict(test) {
  if (!test || !test.days) return null;
  const days = test.days;
  const d1 = days.find(d => d.day === 1);
  const d2 = days.find(d => d.day === 2);
  const d3 = days.find(d => d.day === 3);
  if (!d1 || !d1.completed) return null;
  if (d1.reacted) return { status: 'trigger', detail: 'Reacted at the smallest portion. Strong sensitivity.' };
  if (d2 && d2.completed && d2.reacted) return { status: 'partial', detail: 'Tolerated small portions but reacted at medium. Stick to small servings.' };
  if (d3 && d3.completed && d3.reacted) return { status: 'partial', detail: 'Tolerated small and medium but reacted at large. Watch your portions.' };
  if (d3 && d3.completed && !d3.reacted) return { status: 'tolerated', detail: 'No reactions across all 3 portions. Safe to enjoy.' };
  return null;
}

function nextReintroAction({ currentPhase, reintroProgress, activeTest, periodActive, lastTestEndDate }, lang) {
  const P = (key, vars, en) => patternText(key, vars, lang) || en;
  if (currentPhase !== 'reintroduction') {
    return { type: 'info', text: P('na_locked', {}, 'Reintroduction unlocks after elimination phase.') };
  }
  if (periodActive) {
    return { type: 'pause', text: P('na_pause', {}, 'Pause testing during your period — hormones can amplify symptoms 30-40% and confound results.') };
  }
  if (activeTest) {
    const today = new Date();
    const startDate = new Date(activeTest.startDate);
    const dayNum = Math.floor((today - startDate) / 86400000) + 1;
    const todayLog = activeTest.days.find(d => d.day === dayNum);
    if (dayNum > 3) {
      const verdict = computeVerdict(activeTest);
      if (verdict) {
        const restDay = dayNum - 3;
        if (restDay <= REST_DAYS_BETWEEN_TESTS) {
          return { type: 'rest', text: P('na_rest_settle', { n: restDay, total: REST_DAYS_BETWEEN_TESTS }, `Rest day ${restDay} of ${REST_DAYS_BETWEEN_TESTS}. Let your gut settle before the next test.`) };
        }
        return { type: 'ready', text: P('na_ready_list', {}, 'Ready for the next category. Pick one from the list below.') };
      }
    }
    if (todayLog && todayLog.completed) {
      return { type: 'logged', text: P('na_logged', { n: dayNum }, `Day ${dayNum} logged. Come back tomorrow for the next portion.`) };
    }
    const portionKey = dayNum === 1 ? 'na_portion_small' : dayNum === 2 ? 'na_portion_medium' : 'na_portion_large';
    const portionEn = dayNum === 1 ? 'small' : dayNum === 2 ? 'medium' : 'large';
    const portionLabel = P(portionKey, {}, portionEn);
    return { type: 'today', text: P('na_today', { n: dayNum, portion: portionLabel }, `Day ${dayNum} of 3 - eat the ${portionEn} portion today, then log how you feel.`) };
  }
  if (lastTestEndDate) {
    const daysSince = Math.floor((Date.now() - new Date(lastTestEndDate)) / 86400000);
    if (daysSince < REST_DAYS_BETWEEN_TESTS) {
      return { type: 'rest', text: P('na_rest_before', { n: daysSince + 1, total: REST_DAYS_BETWEEN_TESTS }, `Rest day ${daysSince + 1} of ${REST_DAYS_BETWEEN_TESTS} before testing the next category.`) };
    }
  }
  const completed = Object.keys(reintroProgress).length;
  if (completed === 6) {
    return { type: 'done', text: P('na_done', {}, 'All 6 categories complete! You have finished reintroduction.') };
  }
  return { type: 'ready', text: P('na_ready_begin', {}, 'Ready to test the next category. Pick one below to begin.') };
}

async function parseMealWithAI(text) {
  await new Promise(r => setTimeout(r, 1200));
  const lower = text.toLowerCase();
  const candidates = FOODS.filter(f => {
    const name = f.name.toLowerCase();
    const firstWord = name.split(' ')[0].replace(/[()]/g, '');
    return lower.includes(firstWord) ||
      ((lower.includes('ragu') || lower.includes('bolognese') || lower.includes('sauce')) &&
       (f.id === 'onion' || f.id === 'garlic' || f.id === 'tomato' || f.id === 'beef' || f.id === 'pasta'));
  });
  const seen = new Set();
  const result = [];
  for (const f of candidates) {
    if (!seen.has(f.id)) { seen.add(f.id); result.push(f); }
    if (result.length >= 8) break;
  }
  return result;
}

// Snack-compatible date/time picker: quick buttons + editable HH:MM text input.
function DateTimeRow({ value, onChange }) {
  // Last 14 days (oldest → today), so a forgotten entry can be backdated. Picking
  // a day keeps the current time-of-day — time isn't required, just the day.
  const scrollRef = useRef(null);
  const days = [];
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
  const pick = (d) => { const nd = new Date(d); nd.setHours(value.getHours(), value.getMinutes(), 0, 0); onChange(nd); };

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 13, color: '#3d4d3d', fontWeight: '600', marginBottom: 10 }}>{tG('picker_select_day')}</Text>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 2 }}
        onContentSizeChange={() => scrollRef.current && scrollRef.current.scrollToEnd({ animated: false })}
      >
        {days.map((d, i) => {
          const sel = value.toDateString() === d.toDateString();
          const dowLabel = d.toLocaleDateString(_uiLang, { weekday: 'short' }).toUpperCase();
          const fullLabel = d.toLocaleDateString(_uiLang, { weekday: 'long', day: 'numeric', month: 'long' });
          return (
            <TouchableOpacity key={i} onPress={() => pick(d)} accessibilityRole="radio" accessibilityState={{ selected: sel }} accessibilityLabel={fullLabel} style={{ width: 48, alignItems: 'center' }}>
              <Text importantForAccessibility="no" style={{ fontSize: 11, fontWeight: '600', letterSpacing: 0.5, color: sel ? '#4e7d4e' : '#9aa69a', marginBottom: 6 }}>{dowLabel}</Text>
              <View style={{ width: 38, height: 38, borderRadius: 999, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? '#4e7d4e' : 'transparent' }}>
                <Text importantForAccessibility="no" style={{ fontSize: 17, fontWeight: sel ? '700' : '500', color: sel ? 'white' : '#1c241c' }}>{d.getDate()}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <Text style={{ fontSize: 12, color: '#647264', marginTop: 8 }}>{value.toLocaleDateString(_uiLang, { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
    </View>
  );
}

// ─── PATTERN DETECTION ENGINE ────────────────────────────────────────────
// Pure functions. No AI. Just counting + timestamp comparison over the log.
// Each rule stays silent until there is enough data to be meaningful.
// All wording is observational (correlation), never diagnostic.

const SYMPTOM_WINDOW_HOURS = 6;       // a symptom "follows" a meal if within this window
const MIN_FOOD_OCCURRENCES = 3;       // a food must appear this many times before we report it
const MIN_DAYS_FOR_LIFESTYLE = 4;     // sleep/stress rules need at least this many days of data

function detectPatterns(log, lang, windowDays) {
  const patterns = [];
  if (!log || log.length === 0) return patterns;

  // Optional rolling window: analyse only the last `windowDays` days so the insights
  // reflect recent behaviour and refresh as days pass. The home screen passes 14; the
  // doctor report omits it to summarise the full history.
  const src = windowDays ? log.filter(e => e.timestamp && (Date.now() - new Date(e.timestamp).getTime()) <= windowDays * 86400000) : log;
  const meals = src.filter(e => e.type === 'meal' && e.timestamp);
  const symptoms = src.filter(e => e.type === 'symptom' && e.timestamp);
  const sleeps = src.filter(e => e.type === 'sleep' && e.timestamp);
  const stresses = src.filter(e => e.type === 'stress' && e.timestamp);

  const symptomTimes = symptoms.map(s => new Date(s.timestamp).getTime());

  // ── RULE 1: food → symptom ──────────────────────────────────────────────
  // For each food, count how many times it appeared in a meal, and how often
  // a symptom followed within the window.
  const foodStats = {}; // foodId -> { appeared, followedBySymptom }
  meals.forEach(meal => {
    const mealTime = new Date(meal.timestamp).getTime();
    const symptomFollowed = symptomTimes.some(t => t > mealTime && t <= mealTime + SYMPTOM_WINDOW_HOURS * 3600000);
    const ids = (meal.items || []).map(i => i.foodId);
    const uniqueIds = Array.from(new Set(ids));
    uniqueIds.forEach(id => {
      if (!foodStats[id]) foodStats[id] = { appeared: 0, followedBySymptom: 0 };
      foodStats[id].appeared += 1;
      if (symptomFollowed) foodStats[id].followedBySymptom += 1;
    });
  });

  Object.keys(foodStats).forEach(id => {
    const st = foodStats[id];
    if (st.appeared < MIN_FOOD_OCCURRENCES) return; // not enough data
    const ratio = st.followedBySymptom / st.appeared;
    const food = FOODS.find(f => f.id === id);
    if (!food) return;
    const fn = foodName(food, lang);
    if (ratio >= 0.6 && st.followedBySymptom >= 2) {
      patterns.push({
        id: 'food_' + id,
        severity: 'watch',
        icon: food.emoji || '🍽️',
        title: patternText('pat_food_watch_t', { food: fn }, lang) || `${food.name} may be worth watching`,
        detail: patternText('pat_food_watch_d', { hours: SYMPTOM_WINDOW_HOURS, n: st.followedBySymptom, total: st.appeared, food: fn }, lang) || `You logged symptoms within ${SYMPTOM_WINDOW_HOURS}h after ${st.followedBySymptom} of the ${st.appeared} meals containing ${food.name.toLowerCase()}. That is a correlation, not proof — a proper reintroduction test can confirm it.`,
      });
    } else if (ratio >= 0.3 && st.followedBySymptom >= 1) {
      // Intermediate tier: some correlation but not strong enough to flag firmly.
      patterns.push({
        id: 'food_maybe_' + id,
        severity: 'maybe',
        icon: food.emoji || '🍽️',
        title: patternText('pat_food_maybe_t', { food: fn }, lang) || `${food.name} — a possible link`,
        detail: patternText('pat_food_maybe_d', { n: st.followedBySymptom, total: st.appeared, food: fn }, lang) || `You logged symptoms after ${st.followedBySymptom} of the ${st.appeared} meals with ${food.name.toLowerCase()} — a weak, early signal. Keep logging to see if it holds.`,
      });
    } else if (ratio === 0 && st.appeared >= MIN_FOOD_OCCURRENCES) {
      patterns.push({
        id: 'food_ok_' + id,
        severity: 'good',
        icon: food.emoji || '🍽️',
        title: patternText('pat_food_ok_t', { food: fn }, lang) || `${food.name} looks fine so far`,
        detail: patternText('pat_food_ok_d', { total: st.appeared, food: fn }, lang) || `You ate ${food.name.toLowerCase()} in ${st.appeared} meals with no symptoms following. A reassuring sign.`,
      });
    }
  });

  // ── RULE 2: sleep → symptom ─────────────────────────────────────────────
  // Compare symptom days against the previous night's sleep.
  if (sleeps.length >= MIN_DAYS_FOR_LIFESTYLE) {
    const dayKey = (ts) => new Date(ts).toISOString().slice(0, 10);
    const symptomDays = new Set(symptoms.map(s => dayKey(s.timestamp)));
    let poorSleepDays = 0, poorSleepWithSymptom = 0;
    sleeps.forEach(sl => {
      if ((sl.hours || 0) < 6) {
        poorSleepDays += 1;
        if (symptomDays.has(dayKey(sl.timestamp))) poorSleepWithSymptom += 1;
      }
    });
    if (poorSleepDays >= MIN_DAYS_FOR_LIFESTYLE && poorSleepWithSymptom / poorSleepDays >= 0.6) {
      patterns.push({
        id: 'sleep',
        severity: 'watch',
        icon: '😴',
        title: patternText('pat_sleep_t', {}, lang) || 'Short sleep lines up with rough days',
        detail: patternText('pat_sleep_d', { n: poorSleepWithSymptom, total: poorSleepDays }, lang) || `On ${poorSleepWithSymptom} of the ${poorSleepDays} days you slept under 6 hours, you also logged symptoms. Rest may matter more for your gut than you think.`,
      });
    }
  }

  // ── RULE 3: stress → symptom ────────────────────────────────────────────
  if (stresses.length >= MIN_DAYS_FOR_LIFESTYLE) {
    const dayKey = (ts) => new Date(ts).toISOString().slice(0, 10);
    const symptomDays = new Set(symptoms.map(s => dayKey(s.timestamp)));
    let highStressDays = 0, highStressWithSymptom = 0;
    stresses.forEach(st => {
      if ((st.level || 0) >= 4) {
        highStressDays += 1;
        if (symptomDays.has(dayKey(st.timestamp))) highStressWithSymptom += 1;
      }
    });
    if (highStressDays >= MIN_DAYS_FOR_LIFESTYLE && highStressWithSymptom / highStressDays >= 0.6) {
      patterns.push({
        id: 'stress',
        severity: 'watch',
        icon: '🧘',
        title: patternText('pat_stress_t', {}, lang) || 'High-stress days tend to be symptom days',
        detail: patternText('pat_stress_d', { n: highStressWithSymptom, total: highStressDays }, lang) || `${highStressWithSymptom} of the ${highStressDays} days you logged high stress also had gut symptoms. Stress and the gut are closely linked.`,
      });
    }
  }

  // ── RULE 4: time-of-day clustering ──────────────────────────────────────
  if (symptoms.length >= 4) {
    const buckets = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    symptoms.forEach(s => {
      const h = new Date(s.timestamp).getHours();
      if (h >= 5 && h < 12) buckets.morning += 1;
      else if (h >= 12 && h < 17) buckets.afternoon += 1;
      else if (h >= 17 && h < 22) buckets.evening += 1;
      else buckets.night += 1;
    });
    const top = Object.keys(buckets).reduce((a, b) => buckets[a] >= buckets[b] ? a : b);
    if (buckets[top] / symptoms.length >= 0.5) {
      const labels = { morning: 'the morning', afternoon: 'the afternoon', evening: 'the evening', night: 'overnight' };
      const label = patternText('pat_tod_' + top, {}, lang) || labels[top];
      patterns.push({
        id: 'timeofday',
        severity: 'info',
        icon: '🕐',
        title: patternText('pat_tod_t', { label }, lang) || `Your symptoms cluster in ${labels[top]}`,
        detail: patternText('pat_tod_d', { n: buckets[top], total: symptoms.length, label }, lang) || `${buckets[top]} of your ${symptoms.length} logged symptoms happened in ${labels[top]}. Worth noticing what you eat and do beforehand.`,
      });
    }
  }

  // Order: watch first (most actionable), then info, then good news
  const rank = { watch: 0, maybe: 1, info: 2, good: 3 };
  patterns.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return patterns;
}

// ─── DOCTOR REPORT ───────────────────────────────────────────────────────
// Compiles the user's data into a clean, readable text summary they can
// share with a doctor or dietitian. Plain text — works everywhere, no deps.
const DR_I18N = {
  summary_title: { en: 'GUT HEALTH SUMMARY', de: 'DARMGESUNDHEITS-ÜBERSICHT', es: 'RESUMEN DE SALUD INTESTINAL', fr: 'BILAN DE SANTÉ INTESTINALE', it: 'RIEPILOGO DELLA SALUTE INTESTINALE' },
  generated: { en: 'Generated {date}', de: 'Erstellt am {date}', es: 'Generado el {date}', fr: 'Généré le {date}', it: 'Generato il {date}' },
  about: { en: 'ABOUT', de: 'ÜBER', es: 'ACERCA DE', fr: 'À PROPOS', it: 'INFORMAZIONI' },
  name: { en: 'Name: {name}', de: 'Name: {name}', es: 'Nombre: {name}', fr: 'Nom : {name}', it: 'Nome: {name}' },
  phase_elim: { en: 'Elimination phase', de: 'Eliminationsphase', es: 'Fase de eliminación', fr: "Phase d'élimination", it: 'Fase di eliminazione' },
  phase_reintro: { en: 'Reintroduction phase', de: 'Wiedereinführungsphase', es: 'Fase de reintroducción', fr: 'Phase de réintroduction', it: 'Fase di reintroduzione' },
  phase_none: { en: 'Not started', de: 'Nicht begonnen', es: 'No iniciada', fr: 'Non commencée', it: 'Non iniziata' },
  current_phase: { en: 'Current phase: {phase}', de: 'Aktuelle Phase: {phase}', es: 'Fase actual: {phase}', fr: 'Phase actuelle : {phase}', it: 'Fase attuale: {phase}' },
  phase_started: { en: 'Phase started: {date} ({days} days ago)', de: 'Phase begonnen: {date} (vor {days} Tagen)', es: 'Fase iniciada: {date} (hace {days} días)', fr: 'Phase commencée : {date} (il y a {days} jours)', it: 'Fase iniziata: {date} ({days} giorni fa)' },
  main_symptom: { en: 'Main reported symptom: {s}', de: 'Hauptsächlich berichtetes Symptom: {s}', es: 'Síntoma principal referido: {s}', fr: 'Principal symptôme signalé : {s}', it: 'Sintomo principale riferito: {s}' },
  known: { en: 'Known/suspected intolerances: {list}', de: 'Bekannte/vermutete Unverträglichkeiten: {list}', es: 'Intolerancias conocidas/sospechadas: {list}', fr: 'Intolérances connues/suspectées : {list}', it: 'Intolleranze note/sospette: {list}' },
  menstruates: { en: 'Menstruates: yes (cycle may affect symptoms)', de: 'Menstruiert: ja (Zyklus kann Symptome beeinflussen)', es: 'Menstrúa: sí (el ciclo puede afectar los síntomas)', fr: 'A ses règles : oui (le cycle peut influer sur les symptômes)', it: 'Mestruazioni: sì (il ciclo può influire sui sintomi)' },
  logging: { en: 'LOGGING SUMMARY', de: 'PROTOKOLL-ÜBERSICHT', es: 'RESUMEN DE REGISTROS', fr: 'RÉSUMÉ DU SUIVI', it: 'RIEPILOGO REGISTRAZIONI' },
  total: { en: 'Total entries: {n}', de: 'Einträge gesamt: {n}', es: 'Entradas totales: {n}', fr: 'Entrées au total : {n}', it: 'Voci totali: {n}' },
  meals: { en: 'Meals logged: {n}', de: 'Erfasste Mahlzeiten: {n}', es: 'Comidas registradas: {n}', fr: 'Repas enregistrés : {n}', it: 'Pasti registrati: {n}' },
  symptoms: { en: 'Symptoms logged: {n}', de: 'Erfasste Symptome: {n}', es: 'Síntomas registrados: {n}', fr: 'Symptômes enregistrés : {n}', it: 'Sintomi registrati: {n}' },
  sleep: { en: 'Sleep entries: {n}', de: 'Schlaf-Einträge: {n}', es: 'Entradas de sueño: {n}', fr: 'Entrées de sommeil : {n}', it: 'Voci sul sonno: {n}' },
  stress: { en: 'Stress entries: {n}', de: 'Stress-Einträge: {n}', es: 'Entradas de estrés: {n}', fr: 'Entrées de stress : {n}', it: 'Voci sullo stress: {n}' },
  symptoms_reported: { en: 'SYMPTOMS REPORTED', de: 'BERICHTETE SYMPTOME', es: 'SÍNTOMAS REFERIDOS', fr: 'SYMPTÔMES SIGNALÉS', it: 'SINTOMI RIFERITI' },
  symptom_line: { en: '- {name}: {count} times, average intensity {avg}/5', de: '- {name}: {count} Mal, durchschnittliche Intensität {avg}/5', es: '- {name}: {count} veces, intensidad media {avg}/5', fr: '- {name} : {count} fois, intensité moyenne {avg}/5', it: '- {name}: {count} volte, intensità media {avg}/5' },
  reintro: { en: 'REINTRODUCTION RESULTS', de: 'ERGEBNISSE DER WIEDEREINFÜHRUNG', es: 'RESULTADOS DE REINTRODUCCIÓN', fr: 'RÉSULTATS DE RÉINTRODUCTION', it: 'RISULTATI DELLA REINTRODUZIONE' },
  tolerated: { en: 'TOLERATED', de: 'VERTRAGEN', es: 'TOLERADO', fr: 'TOLÉRÉ', it: 'TOLLERATO' },
  trigger: { en: 'TRIGGER IDENTIFIED', de: 'AUSLÖSER IDENTIFIZIERT', es: 'DESENCADENANTE IDENTIFICADO', fr: 'DÉCLENCHEUR IDENTIFIÉ', it: 'FATTORE SCATENANTE IDENTIFICATO' },
  challenge: { en: 'FOOD CHALLENGE DETAIL', de: 'DETAILS DER NAHRUNGSMITTELTESTS', es: 'DETALLE DE LAS PRUEBAS DE ALIMENTOS', fr: 'DÉTAIL DES TESTS ALIMENTAIRES', it: 'DETTAGLIO DEI TEST ALIMENTARI' },
  patterns: { en: 'OBSERVED PATTERNS (correlations, not diagnoses)', de: 'BEOBACHTETE MUSTER (Korrelationen, keine Diagnosen)', es: 'PATRONES OBSERVADOS (correlaciones, no diagnósticos)', fr: 'TENDANCES OBSERVÉES (corrélations, pas des diagnostics)', it: 'SCHEMI OSSERVATI (correlazioni, non diagnosi)' },
  footer: { en: 'This summary was generated by GutBloom, a self-tracking app.\nIt reflects self-reported data and is intended to support,\nnot replace, professional medical assessment.', de: 'Diese Übersicht wurde von GutBloom erstellt, einer Selbst-Tracking-App.\nSie beruht auf selbst berichteten Daten und soll eine professionelle\nmedizinische Beurteilung unterstützen, nicht ersetzen.', es: 'Este resumen fue generado por GutBloom, una app de autoseguimiento.\nRefleja datos autoinformados y está pensado para apoyar,\nno sustituir, la evaluación médica profesional.', fr: 'Ce bilan a été généré par GutBloom, une app de suivi personnel.\nIl reflète des données autodéclarées et vise à soutenir,\nnon à remplacer, une évaluation médicale professionnelle.', it: "Questo riepilogo è stato generato da GutBloom, un'app di auto-monitoraggio.\nRiflette dati auto-riferiti ed è pensato per supportare,\nnon sostituire, una valutazione medica professionale." },
};
function buildDoctorReport({ profile, log, reintroProgress, testHistory, currentPhase, phaseStartDate }, lang) {
  const d = (key, vars) => { let s = (DR_I18N[key] && (DR_I18N[key][lang] || DR_I18N[key].en)) || key; if (vars) Object.keys(vars).forEach(k => { s = s.split('{' + k + '}').join(vars[k]); }); return s; };
  const L = [];
  const line = (t) => L.push(t == null ? '' : t);
  const rule = () => L.push('----------------------------------------');
  const dateStr = new Date().toLocaleDateString(lang);

  line('GUTLY — ' + d('summary_title'));
  line(d('generated', { date: dateStr }));
  rule();
  line('');

  // Profile
  line(d('about'));
  if (profile.name) line(d('name', { name: profile.name }));
  const phaseLabel = currentPhase === 'elimination' ? d('phase_elim')
    : currentPhase === 'reintroduction' ? d('phase_reintro')
    : d('phase_none');
  line(d('current_phase', { phase: phaseLabel }));
  if (phaseStartDate) {
    const days = Math.floor((Date.now() - new Date(phaseStartDate)) / 86400000);
    line(d('phase_started', { date: new Date(phaseStartDate).toLocaleDateString(lang), days }));
  }
  if (profile.symptom) line(d('main_symptom', { s: profile.symptom }));
  const known = profile.known || [];
  if (known.length) line(d('known', { list: known.join(', ') }));
  if (profile.menstruates === 'yes') line(d('menstruates'));
  line('');

  // Logging summary
  const meals = log.filter(e => e.type === 'meal');
  const symptoms = log.filter(e => e.type === 'symptom');
  const sleeps = log.filter(e => e.type === 'sleep');
  const stresses = log.filter(e => e.type === 'stress');
  line(d('logging'));
  line(d('total', { n: log.length }));
  line(d('meals', { n: meals.length }));
  line(d('symptoms', { n: symptoms.length }));
  line(d('sleep', { n: sleeps.length }));
  line(d('stress', { n: stresses.length }));
  line('');

  // Symptom detail
  if (symptoms.length) {
    line(d('symptoms_reported'));
    const byType = {};
    symptoms.forEach(s => {
      if (!byType[s.symptom]) byType[s.symptom] = { count: 0, intensitySum: 0 };
      byType[s.symptom].count += 1;
      byType[s.symptom].intensitySum += (s.intensity || 0);
    });
    Object.keys(byType).forEach(k => {
      const b = byType[k];
      const avg = (b.intensitySum / b.count).toFixed(1);
      line(d('symptom_line', { name: k, count: b.count, avg }));
    });
    line('');
  }

  // Reintroduction results
  const reintroKeys = Object.keys(reintroProgress);
  if (reintroKeys.length) {
    line(d('reintro'));
    reintroKeys.forEach(cat => {
      const info = REINTRO_ORDER.find(r => r.id === cat);
      const result = reintroProgress[cat] === 'tolerated' ? d('tolerated') : d('trigger');
      line('- ' + (info ? info.name : cat) + ': ' + result);
    });
    line('');
  }
  if (testHistory && testHistory.length) {
    line(d('challenge'));
    testHistory.forEach(t => {
      const info = REINTRO_ORDER.find(r => r.id === t.categoryId);
      line('- ' + (info ? info.name : t.categoryId) + (t.verdict ? ': ' + t.verdict.detail : ''));
    });
    line('');
  }

  // Patterns
  const patterns = detectPatterns(log, lang);
  if (patterns.length) {
    line(d('patterns'));
    patterns.forEach(p => line('- ' + p.title + '. ' + p.detail));
    line('');
  }

  rule();
  line(d('footer'));
  return L.join('\n');
}

// ─── PERSISTENCE ──────────────────────────────────────────────────────────
// Saves user state to AsyncStorage so the app survives reloads.
// Design principles:
//  1. Each key loads independently — one corrupt value never blocks the rest.
//  2. Every read/write is wrapped in try/catch — storage failure cannot crash the app.
//  3. SCHEMA_VERSION lets future code migrate or invalidate old data safely.
//  4. Writes happen automatically via useEffect on each state value — no manual save calls.
const SCHEMA_VERSION = 1;
const STORAGE_KEYS = {
  schemaVersion:   '@gutly:schema',
  profile:         '@gutly:profile',
  langPref:        '@gutly:langPref',
  log:             '@gutly:log',
  reintroProgress: '@gutly:reintroProgress',
  testHistory:     '@gutly:testHistory',
  activeTest:      '@gutly:activeTest',
  currentPhase:    '@gutly:currentPhase',
  phaseStartDate:  '@gutly:phaseStartDate',
  isPremium:       '@gutly:isPremium',
  scanUsage:       '@gutly:scanUsage',
  periodActive:    '@gutly:periodActive',
  onboardingDone:  '@gutly:onboardingDone',
  celebratedLevel: '@gutly:celebratedLevel',
  barcodeIntroSeen: '@gutly:barcodeIntroSeen',
  customFoods:     '@gutly:customFoods',
  accountBannerDismissed: '@gutly:accountBannerDismissed',
};

async function storageGet(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('storageGet failed for', key, e);
    return null;
  }
}

async function storageSet(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('storageSet failed for', key, e);
  }
}

export default function App() {
  const [screen, setScreen] = useState('onboarding');
  // Language: 'auto' follows the phone; otherwise an explicit override from Settings.
  const [langPref, setLangPref] = useState('auto');
  // Regular users always follow the phone's language. The manual override is a
  // dev-only testing aid, so in release builds we ignore any stored preference.
  const lang = langPref === 'auto' ? detectLang() : langPref;
  const t = useMemo(() => makeT(lang), [lang]);   // stable across renders so memoized screens can skip re-rendering
  _uiLang = lang;
  const [onbStep, setOnbStep] = useState(0);
  const [profile, setProfile] = useState({});
  const [tab, setTab] = useState('home');
  const foodsMounted = useRef(false), planMounted = useRef(false), chatMounted = useRef(false);   // keep-alive latches
  const [recipesReturn, setRecipesReturn] = useState('home'); // tab to return to from recipes
  const openRecipes = (from) => { setRecipesReturn(from); setTab('recipes'); };
  const [log, setLog] = useState([]);
  const [customFoods, setCustomFoods] = useState([]);
  const [reintroProgress, setReintroProgress] = useState({});
  // Kept-alive Foods screen, memoized so it doesn't re-render on unrelated App renders (e.g.
  // tapping another tab). Same element reference → React skips the subtree. Rebuilds only when
  // its real inputs change. Declared before any early return to satisfy the rules of hooks.
  const foodsScreenEl = useMemo(() => (
    <FoodExplorerScreen reintroProgress={reintroProgress} onOpenRecipes={() => { setRecipesReturn('foods'); setTab('recipes'); }} profile={profile} t={t} lang={lang} />
  ), [reintroProgress, profile, t, lang]);
  const [activeTest, setActiveTest] = useState(null);
  const [testHistory, setTestHistory] = useState([]);
  const [pendingReintroPrompt, setPendingReintroPrompt] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  // AI scan allowance: tracks scans used and which month the count belongs to.
  const [scanUsage, setScanUsage] = useState({ month: new Date().toISOString().slice(0, 7), used: 0 });
  const [periodActive, setPeriodActive] = useState(false);
  const [currentPhase, setCurrentPhase] = useState('not_started');
  const [phaseStartDate, setPhaseStartDate] = useState(null);
  // Supabase auth session. Null = signed out (the app is fully usable signed out —
  // an account just backs up and syncs data). `user` is the logged-in account.
  const [session, setSession] = useState(null);
  const user = session ? session.user : null;
  // Dismissible "save your progress" home banner (guest-first: nudge, never block).
  const [accountBannerDismissed, setAccountBannerDismissed] = useState(false);

  // Gamification level-up: `celebratedLevel` is the highest level already
  // acknowledged; `levelUp` holds a level number while its celebration shows.
  const [celebratedLevel, setCelebratedLevel] = useState(null);
  const [levelUp, setLevelUp] = useState(null);
  const [feedback, setFeedback] = useState(null); // post-log Flora reaction

  // Hydration: app does not render UI until persisted state has loaded.
  // This prevents a flicker where onboarding briefly shows for a returning user.
  const [hydrated, setHydrated] = useState(false);
  // Minimum splash time so the launch animation plays even on a fast load.
  const [splashDone, setSplashDone] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSplashDone(true), 1600); return () => clearTimeout(t); }, []);
  // Sync the OS "Reduce Motion" setting into the module flag so animations can honour it.
  useEffect(() => {
    let sub;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { _reduceMotion = v; }).catch(() => {});
    sub = AccessibilityInfo.addEventListener('reduceMotionChanged', v => { _reduceMotion = v; });
    return () => { sub && sub.remove && sub.remove(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Schema check first. If we ever change the shape of stored data, we bump
      // SCHEMA_VERSION and the mismatch causes us to ignore the old data safely.
      const storedVersion = await storageGet(STORAGE_KEYS.schemaVersion);
      const schemaOk = storedVersion === SCHEMA_VERSION;

      if (schemaOk) {
        // Each piece loads independently. A failure on one key never blocks the rest.
        const [
          sProfile, sLang, sLog, sReintro, sHistory, sActive,
          sPhase, sPhaseDate, sPremium, sScan, sPeriod, sOnbDone, sCelebrated, sCustomFoods, sBannerDismissed,
        ] = await Promise.all([
          storageGet(STORAGE_KEYS.profile),
          storageGet(STORAGE_KEYS.langPref),
          storageGet(STORAGE_KEYS.log),
          storageGet(STORAGE_KEYS.reintroProgress),
          storageGet(STORAGE_KEYS.testHistory),
          storageGet(STORAGE_KEYS.activeTest),
          storageGet(STORAGE_KEYS.currentPhase),
          storageGet(STORAGE_KEYS.phaseStartDate),
          storageGet(STORAGE_KEYS.isPremium),
          storageGet(STORAGE_KEYS.scanUsage),
          storageGet(STORAGE_KEYS.periodActive),
          storageGet(STORAGE_KEYS.onboardingDone),
          storageGet(STORAGE_KEYS.celebratedLevel),
          storageGet(STORAGE_KEYS.customFoods),
          storageGet(STORAGE_KEYS.accountBannerDismissed),
        ]);
        if (cancelled) return;
        if (typeof sCelebrated === 'number') setCelebratedLevel(sCelebrated);
        if (sBannerDismissed === true) setAccountBannerDismissed(true);
        // Register saved custom foods into FOODS so meals referencing them resolve everywhere.
        if (Array.isArray(sCustomFoods)) { sCustomFoods.forEach(registerCustomFood); setCustomFoods(sCustomFoods); }

        // Apply only valid values. Null = no saved value yet, keep the default.
        if (sProfile && typeof sProfile === 'object') setProfile(sProfile);
        if (typeof sLang === 'string') setLangPref(sLang);
        if (Array.isArray(sLog)) setLog(sLog);
        if (sReintro && typeof sReintro === 'object') setReintroProgress(sReintro);
        if (Array.isArray(sHistory)) setTestHistory(sHistory);
        if (sActive === null || (sActive && typeof sActive === 'object')) setActiveTest(sActive);
        if (typeof sPhase === 'string') setCurrentPhase(sPhase);
        if (sPhaseDate === null || typeof sPhaseDate === 'string') setPhaseStartDate(sPhaseDate);
        if (typeof sPremium === 'boolean') setIsPremium(sPremium);
        if (sScan && typeof sScan === 'object' && typeof sScan.used === 'number') setScanUsage(sScan);
        if (typeof sPeriod === 'boolean') setPeriodActive(sPeriod);
        // If onboarding was completed previously, jump straight to the main screen.
        if (sOnbDone === true) setScreen('main');
      } else {
        // Schema bump or first run — write the current version so future loads match.
        await storageSet(STORAGE_KEYS.schemaVersion, SCHEMA_VERSION);
      }

      if (!cancelled) setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Auto-save effects — each piece of state writes to storage when it changes.
  // Guarded by `hydrated` so the initial load does not race with a save of empty defaults.
  useEffect(() => { if (hydrated) storageSet(STORAGE_KEYS.profile, profile); }, [profile, hydrated]);
  useEffect(() => { if (hydrated) storageSet(STORAGE_KEYS.langPref, langPref); }, [langPref, hydrated]);
  useEffect(() => { if (hydrated) storageSet(STORAGE_KEYS.log, log); }, [log, hydrated]);
  useEffect(() => { if (hydrated) storageSet(STORAGE_KEYS.customFoods, customFoods); }, [customFoods, hydrated]);
  useEffect(() => { if (hydrated) storageSet(STORAGE_KEYS.accountBannerDismissed, accountBannerDismissed); }, [accountBannerDismissed, hydrated]);
  useEffect(() => { if (hydrated) storageSet(STORAGE_KEYS.reintroProgress, reintroProgress); }, [reintroProgress, hydrated]);
  useEffect(() => { if (hydrated) storageSet(STORAGE_KEYS.testHistory, testHistory); }, [testHistory, hydrated]);
  useEffect(() => { if (hydrated) storageSet(STORAGE_KEYS.activeTest, activeTest); }, [activeTest, hydrated]);
  useEffect(() => { if (hydrated) storageSet(STORAGE_KEYS.currentPhase, currentPhase); }, [currentPhase, hydrated]);
  useEffect(() => { if (hydrated) storageSet(STORAGE_KEYS.phaseStartDate, phaseStartDate); }, [phaseStartDate, hydrated]);
  useEffect(() => { if (hydrated) storageSet(STORAGE_KEYS.isPremium, isPremium); }, [isPremium, hydrated]);
  useEffect(() => { if (hydrated) storageSet(STORAGE_KEYS.scanUsage, scanUsage); }, [scanUsage, hydrated]);
  useEffect(() => { if (hydrated) storageSet(STORAGE_KEYS.periodActive, periodActive); }, [periodActive, hydrated]);
  // Mark onboarding as done when the screen moves to 'main' for the first time.
  useEffect(() => { if (hydrated && screen === 'main') storageSet(STORAGE_KEYS.onboardingDone, true); }, [screen, hydrated]);

  // Level-up detection. Level is derived from the log + reintro state; when it
  // exceeds the last celebrated level we fire the celebration. On first run with
  // this feature we baseline silently so existing users aren't spammed.
  useEffect(() => {
    if (!hydrated) return;
    const level = computeGamification(log, reintroProgress).level;
    if (celebratedLevel == null) {
      setCelebratedLevel(level);
      storageSet(STORAGE_KEYS.celebratedLevel, level);
    } else if (level > celebratedLevel) {
      setFeedback(null); // a level-up celebration takes precedence over log feedback
      // The colony fills at level 13 (12 friends) — celebrate that completion specially.
      setLevelUp({ level, complete: level >= 13 && celebratedLevel < 13 });
      setCelebratedLevel(level);
      storageSet(STORAGE_KEYS.celebratedLevel, level);
    }
  }, [log, reintroProgress, hydrated, celebratedLevel]);

  // ── FREE vs PREMIUM ──────────────────────────────────────────────────
  // Principle: never gate safety. Food lookup, barcode, all logging, GutGuide,
  // and the complete elimination phase are free forever. Premium unlocks the
  // long-haul depth: full reintroduction, all recipes, full pattern history.
  const FREE_RECIPE_LIMIT = 10;        // free users see 10 of 50+ recipes
  const FREE_REINTRO_CATEGORIES = 0;   // reintroduction is fully premium; paywall triggers at phase start
  const PREMIUM_SCANS_PER_MONTH = 30;  // metered allowance for AI meal scanning

  const showToast = (msg) => { setToast(msg); AccessibilityInfo.announceForAccessibility(msg); setTimeout(() => setToast(null), 2500); };
  const dayCount = log.length === 0 ? 0 : Math.max(1, Math.floor((Date.now() - parseInt(log[0].id.slice(1).replace(/\D/g, ''))) / 86400000) + 1);

  // ── ACCOUNT / AUTH + SYNC ─────────────────────────────────────────────
  // Refs mirror the latest state so async sync callbacks (registered once on
  // mount) never read stale values from an old render's closure.
  const logRef = useRef(log); logRef.current = log;
  const customFoodsRef = useRef(customFoods); customFoodsRef.current = customFoods;
  const userRef = useRef(user); userRef.current = user;

  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState(null); // ms timestamp of last successful sync
  const tsMs = (x) => (x ? Date.parse(x) : 0);

  // First login stamps the signed-in user's id onto every local record that
  // still has `ownerId: null`, so sync knows those records are theirs.
  const backfillOwnerId = (ownerId) => {
    const now = new Date().toISOString();
    setCustomFoods(prev => {
      let changed = false;
      const next = prev.map(f => {
        if (f.ownerId == null) { changed = true; return Object.assign({}, f, { ownerId, updatedAt: now }); }
        return f;
      });
      return changed ? next : prev;
    });
  };

  // Every syncable local record → a row for the `records` table. Log entries take
  // their updated_at from the entry timestamp (they don't store one locally yet);
  // custom foods already carry updatedAt. The full record is stored as `data` jsonb.
  const collectLocalRows = (ownerId) => {
    const nowIso = new Date().toISOString();
    const rows = [];
    logRef.current.forEach(e => rows.push({ owner_id: ownerId, id: e.id, kind: 'log', data: e, updated_at: e.updatedAt || e.timestamp || nowIso, deleted: false }));
    customFoodsRef.current.forEach(f => rows.push({ owner_id: ownerId, id: f.id, kind: 'customFood', data: f, updated_at: f.updatedAt || f.createdAt || nowIso, deleted: false }));
    return rows;
  };

  // Merge remote rows into local state, last-write-wins by updated_at, honoring
  // tombstones. Additive: nothing local is dropped unless the server says deleted.
  const mergeRemote = (remoteRows) => {
    const logRows = remoteRows.filter(r => r.kind === 'log');
    const foodRows = remoteRows.filter(r => r.kind === 'customFood');
    if (logRows.length) {
      setLog(prev => {
        const map = new Map(prev.map(e => [e.id, e]));
        logRows.forEach(r => {
          const local = map.get(r.id);
          const localUpd = local ? tsMs(local.updatedAt || local.timestamp) : -1;
          if (!local || tsMs(r.updated_at) > localUpd) { if (r.deleted) map.delete(r.id); else map.set(r.id, r.data); }
        });
        return Array.from(map.values()).sort((a, b) => tsMs(a.timestamp) - tsMs(b.timestamp));
      });
    }
    if (foodRows.length) {
      setCustomFoods(prev => {
        const map = new Map(prev.map(f => [f.id, f]));
        foodRows.forEach(r => {
          const local = map.get(r.id);
          const localUpd = local ? tsMs(local.updatedAt || local.createdAt) : -1;
          if (!local || tsMs(r.updated_at) > localUpd) { if (r.deleted) map.delete(r.id); else map.set(r.id, r.data); }
        });
        const next = Array.from(map.values());
        next.forEach(registerCustomFood);
        return next;
      });
    }
  };

  // Full two-way sync: push all local rows, then pull the user's rows and merge.
  // Failures are non-fatal — the app stays usable offline and the next trigger retries.
  const syncingRef = useRef(false);
  const syncNow = async (ownerId) => {
    if (!ownerId || syncingRef.current) return;
    syncingRef.current = true; setSyncing(true);
    try {
      const rows = collectLocalRows(ownerId);
      if (rows.length) {
        const { error: upErr } = await supabase.from('records').upsert(rows, { onConflict: 'owner_id,id' });
        if (upErr) throw upErr;
      }
      const { data, error: selErr } = await supabase.from('records').select('id,kind,data,updated_at,deleted').eq('owner_id', ownerId);
      if (selErr) throw selErr;
      if (Array.isArray(data)) mergeRemote(data);
      setLastSync(Date.now());
    } catch (e) {
      console.warn('[gutly] sync failed:', e && e.message);
      showToast(t('sync_failed'));
    } finally {
      syncingRef.current = false; setSyncing(false);
    }
  };

  // Track whether we've already backfilled this session so a token refresh that
  // re-fires SIGNED_IN doesn't run it twice.
  const backfilledRef = useRef(false);
  useEffect(() => {
    let mounted = true;
    // Restore a persisted session on launch (fires as INITIAL_SESSION, no toast) and pull.
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session && data.session.user) syncNow(data.session.user.id);
    });
    const { data: authSub } = supabase.auth.onAuthStateChange((event, sess) => {
      if (!mounted) return;
      setSession(sess);
      if (event === 'SIGNED_IN' && sess && sess.user) {
        if (!backfilledRef.current) { backfilledRef.current = true; backfillOwnerId(sess.user.id); }
        showToast(t('auth_welcome_toast'));
        syncNow(sess.user.id);
      }
      if (event === 'SIGNED_OUT') { backfilledRef.current = false; setLastSync(null); }
    });
    return () => { mounted = false; authSub.subscription.unsubscribe(); };
  }, []);

  // Push local changes up shortly after they happen (debounced), while signed in.
  useEffect(() => {
    if (!hydrated || !user) return;
    const id = setTimeout(() => {
      const rows = collectLocalRows(user.id);
      if (rows.length) supabase.from('records').upsert(rows, { onConflict: 'owner_id,id' }).then(({ error }) => { if (error) console.warn('[gutly] push failed:', error.message); });
    }, 1500);
    return () => clearTimeout(id);
  }, [log, customFoods, user, hydrated]);

  // Pull fresh data when the app returns to the foreground (catches edits from another device).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active' && userRef.current) syncNow(userRef.current.id); });
    return () => sub.remove();
  }, []);

  const signOut = async () => { await supabase.auth.signOut(); showToast(t('auth_signed_out')); };

  // Wipe all persisted data and return to onboarding — a fresh start.
  const resetApp = async () => {
    await supabase.auth.signOut().catch(() => {});
    await AsyncStorage.clear();
    setProfile({});
    setLog([]);
    setReintroProgress({});
    setActiveTest(null);
    setTestHistory([]);
    setCurrentPhase('not_started');
    setPhaseStartDate(null);
    setIsPremium(false);
    setPeriodActive(false);
    setOnbStep(0);
    setModal(null);
    setTab('home');
    setCelebratedLevel(null);
    setLevelUp(null);
    setScreen('onboarding');
  };

  // Dev-only: seed the app into a chosen state for previewing on device.
  // 'empty' = first run · 'mid' = a week in · 'elimDone' = elimination complete, reintro locked · 'max' = thriving, full colony.
  const seedDemo = (intensity) => {
    if (intensity === 'empty') {
      setLog([]); setReintroProgress({}); setCurrentPhase('elimination');
      setPhaseStartDate(new Date().toISOString()); setActiveTest(null);
    } else {
      const days = intensity === 'max' ? 32 : intensity === 'elimDone' ? 42 : 8;
      const lowFoods = ['carrot', 'potato', 'cucumber', 'lettuce'];
      const newLog = [];
      for (let d = days - 1; d >= 0; d--) {
        const dt = new Date(); dt.setDate(dt.getDate() - d);
        [9, 13, 19].forEach((hr, j) => {
          dt.setHours(hr, 0, 0, 0);
          newLog.push({ id: `m${dt.getTime()}${j}`, type: 'meal', time: `${hr}:00`, items: [{ foodId: lowFoods[(d + j) % lowFoods.length], portionG: 100 }], timestamp: dt.toISOString() });
        });
        const sl = new Date(dt); sl.setHours(23, 0, 0, 0);
        newLog.push({ id: `sl${sl.getTime()}`, type: 'sleep', time: '23:00', hours: 8, timestamp: sl.toISOString() });
      }
      setLog(newLog);
      if (intensity === 'elimDone') {
        // Full 6-week elimination, nothing reintroduced yet, Premium OFF → reintroduction stays locked behind the paywall.
        setReintroProgress({});
        setCurrentPhase('elimination');
        setIsPremium(false);
      } else {
        setReintroProgress(intensity === 'max'
          ? { lactose: 'tolerated', fructose: 'tolerated', sorbitol: 'trigger', mannitol: 'tolerated', gos: 'tolerated', fructans: 'trigger' }
          : { lactose: 'tolerated' });
        setCurrentPhase(intensity === 'max' ? 'reintroduction' : 'elimination');
      }
      setPhaseStartDate(new Date(Date.now() - days * 86400000).toISOString());
      setActiveTest(null);
    }
    // Suppress the level-up popup while previewing (resetApp restores normal behaviour).
    setCelebratedLevel(99);
    setModal(null);
    setScreen('main');
  };

  const startElimination = () => {
    setCurrentPhase('elimination');
    setPhaseStartDate(new Date().toISOString());
    showToast(t('toast_elim_started'));
  };
  const startReintroduction = () => {
    if (!isPremium) { setModal({ type: 'paywall', reason: 'reintro' }); return; }
    setCurrentPhase('reintroduction');
    setPhaseStartDate(new Date().toISOString());
    showToast(t('toast_reintro_started'));
  };
  const overridePhaseWeek = (phase, weekNumber) => {
    const daysAgo = (weekNumber - 1) * 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    setCurrentPhase(phase);
    setPhaseStartDate(startDate.toISOString());
    showToast(t('toast_updated'));
  };

  const updateLogEntry = (id, updates) => {
    setLog(log.map(e => e.id === id ? Object.assign({}, e, updates) : e));
    showToast(t('toast_updated'));
  };
  const deleteLogEntry = (id) => {
    setLog(log.filter(e => e.id !== id));
    showToast(t('toast_deleted'));
  };

  const startReintroTest = (categoryId, foodId) => {
    const today = new Date();
    const test = {
      categoryId, foodId,
      startDate: today.toISOString(),
      days: [{ day: 1, completed: false, reacted: null }, { day: 2, completed: false, reacted: null }, { day: 3, completed: false, reacted: null }],
    };
    setActiveTest(test);
    showToast(t('toast_test_started'));
  };

  const logReintroDay = (dayNum, reacted, severity = 0) => {
    if (!activeTest) return;
    const updated = Object.assign({}, activeTest, { days: activeTest.days.map(d => d.day === dayNum ? Object.assign({}, d, { completed: true, reacted, severity }) : d) });
    const stopEarly = (dayNum === 1 && reacted) || severity >= 4;
    if (stopEarly || dayNum === 3) {
      const verdict = computeVerdict(updated);
      if (verdict) {
        setReintroProgress(p => Object.assign({}, p, { [updated.categoryId]: verdict.status === 'tolerated' ? 'tolerated' : 'trigger' }));
        setTestHistory(h => h.concat([Object.assign({}, updated, { verdict, endDate: new Date().toISOString() })]));
        setActiveTest(null);
        showToast(verdict.status === 'tolerated' ? t('toast_test_tolerated') : t('toast_test_complete'));
        return;
      }
    }
    setActiveTest(updated);
    showToast(t('toast_day_logged', { n: dayNum }));
  };

  const cancelActiveTest = () => {
    setActiveTest(null);
    showToast(t('toast_test_cancelled'));
  };

  // Scans remaining this month, auto-resetting when the calendar month changes.
  const currentMonth = new Date().toISOString().slice(0, 7);
  const scansUsedThisMonth = scanUsage.month === currentMonth ? scanUsage.used : 0;
  const scansRemaining = Math.max(0, PREMIUM_SCANS_PER_MONTH - scansUsedThisMonth);

  const openAIScan = () => {
    if (!isPremium) { setModal({ type: 'paywall', reason: 'scan' }); return; }
    if (scansRemaining <= 0) { setModal('scanLimit'); return; }
    setModal('aiscan');
  };

  const recordScanUsed = () => {
    setScanUsage(prev => prev.month === currentMonth
      ? { month: currentMonth, used: prev.used + 1 }
      : { month: currentMonth, used: 1 });
  };


  const onAddCustomFood = (food) => { registerCustomFood(food); setCustomFoods(prev => prev.concat([food])); };
  const updateCustomFood = (id, patch) => {
    const ff = FOODS.find(f => f.id === id); if (ff) Object.assign(ff, patch);   // keep the live FOODS entry in sync
    setCustomFoods(prev => prev.map(f => f.id === id ? Object.assign({}, f, patch, { updatedAt: new Date().toISOString() }) : f));
  };
  const deleteCustomFood = (id) => {
    const i = FOODS.findIndex(f => f.id === id); if (i >= 0) FOODS.splice(i, 1);
    setCustomFoods(prev => prev.filter(f => f.id !== id));
  };

  const onMealSave = (items, when, mealType, dishes) => {
    const time = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
    const entry = { id: 'm' + Date.now(), type: 'meal', time, items, timestamp: when.toISOString(), mealType: mealType || defaultMealType(when) };
    if (dishes && dishes.length) entry.mealDishes = dishes;   // dish names to title the meal
    setLog(log.concat([entry]));
    setModal(null);
    let reintroMatched = false;
    if (activeTest) {
      const testFoodId = activeTest.foodId;
      const testCategory = activeTest.categoryId;
      const matched = items.find(it => {
        const food = FOODS.find(f => f.id === it.foodId);
        if (!food) return false;
        return food.id === testFoodId || food.groups.includes(testCategory);
      });
      if (matched) {
        reintroMatched = true;
        const food = FOODS.find(f => f.id === matched.foodId);
        setTimeout(() => setPendingReintroPrompt({ foodName: food?.name || 'food', categoryId: testCategory }), 600);
      }
    }
    // Flora reacts to the meal — unless a reintro prompt is about to take over.
    if (!reintroMatched) setFeedback(logFeedback('meal', categorizeMeal(items || [], reintroProgress).overall, t));
  };

  // Keep-alive tab screens: memoize each so tapping between tabs never re-renders the hidden
  // ones (that was the per-tap lag). Deps list every value the screen actually displays; inline
  // handlers close over stable state setters and don't need to be deps. nextAction is memoized
  // too — it's a freshly-built object each render, which would otherwise defeat Plan's memo.
  const nextAction = useMemo(() => nextReintroAction({ currentPhase, reintroProgress, activeTest, periodActive, lastTestEndDate: testHistory[testHistory.length - 1]?.endDate }, lang), [currentPhase, reintroProgress, activeTest, periodActive, testHistory, lang]);
  const homeScreenEl = useMemo(() => (
    <HomeScreen profile={profile} log={log} dayCount={dayCount} reintroProgress={reintroProgress} periodActive={periodActive} currentPhase={currentPhase} phaseStartDate={phaseStartDate} onStartElimination={startElimination} onStartReintroduction={startReintroduction} onOpenSettings={() => setModal('settings')} onLogPeriod={() => { setPeriodActive(!periodActive); showToast(periodActive ? t('toast_period_ended') : t('toast_period_started')); }} onEditEntry={(entry) => setModal({ type: 'edit', entry })} onQuickLog={(type) => setModal(type)} onOpenHistory={() => setModal('history')} onOpenRecipes={() => openRecipes('home')} onOpenRecipe={(recipe) => setModal({ type: 'recipe', recipe })} onOpenColony={() => setModal('colony')} onOpenProgress={() => setModal('progress')} onOpenPatterns={() => setModal('patterns')} onGoToPlan={() => setTab('plan')} onDiagnosed={() => { setProfile(p => Object.assign({}, p, { ibsDiagnosed: 'yes' })); showToast(t('toast_diagnosed')); }} signedIn={!!user} onOpenAccount={() => setModal({ type: 'account', mode: 'signup' })} accountBannerDismissed={accountBannerDismissed} onDismissAccountBanner={() => setAccountBannerDismissed(true)} lang={lang} t={t} />
  ), [profile, log, dayCount, reintroProgress, periodActive, currentPhase, phaseStartDate, user, accountBannerDismissed, lang, t]);
  const planScreenEl = useMemo(() => (
    <PlanScreen profile={profile} reintroProgress={reintroProgress} periodActive={periodActive} currentPhase={currentPhase} phaseStartDate={phaseStartDate} onStartElimination={startElimination} onStartReintroduction={startReintroduction} activeTest={activeTest} onLogReintroDay={logReintroDay} onCancelTest={cancelActiveTest} onPickTestCategory={(catId) => setModal({ type: 'startTest', categoryId: catId })} nextAction={nextAction} isPremium={isPremium} freeReintroLimit={FREE_REINTRO_CATEGORIES} onUpsell={() => setModal({ type: 'paywall', reason: 'reintro' })} t={t} />
  ), [profile, reintroProgress, periodActive, currentPhase, phaseStartDate, activeTest, nextAction, isPremium, t]);
  const chatScreenEl = useMemo(() => <GutGuideScreen t={t} lang={lang} />, [t, lang]);

  // Block initial render until persisted state has loaded. Without this, a
  // returning user would briefly see onboarding before their saved data hydrates.
  if (!hydrated || !splashDone) {
    return <SplashScreen t={t} />;
  }

  if (screen === 'onboarding') {
    return <OnboardingScreen step={onbStep} setStep={setOnbStep} profile={profile} setProfile={setProfile} t={t} onComplete={() => {
      if (profile.phase === 'elimination' && currentPhase === 'not_started') {
        setCurrentPhase('elimination');
        setPhaseStartDate(new Date().toISOString());
      } else if (profile.phase === 'reintro' && currentPhase === 'not_started') {
        setCurrentPhase('reintroduction');
        setPhaseStartDate(new Date().toISOString());
      }
      setScreen('main');
      showToast(`Welcome, ${profile.name || 'friend'} 🌱`);
    }} />;
  }

  // Latch each heavy tab as "mounted" on first visit, then keep it alive (just hidden) so
  // re-entering is instant instead of paying a full remount. Latches in-render (no blank frame).
  if (tab === 'foods') foodsMounted.current = true;
  if (tab === 'plan') planMounted.current = true;
  if (tab === 'chat') chatMounted.current = true;

  return (
    <SafeAreaProvider>
    <SafeAreaViewSC style={s.root} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.bg} />
      {/* Home is the default tab so it's always mounted; the others mount lazily on first visit
          and then stay alive (hidden) so switching back is instant. Each is a memoized element,
          so tapping a tab doesn't re-render the hidden screens. */}
      <View style={{ flex: 1, display: tab === 'home' ? 'flex' : 'none' }}>{homeScreenEl}</View>
      {tab === 'recipes' && <RecipesScreen onOpenRecipe={(recipe) => setModal({ type: 'recipe', recipe })} onBack={() => setTab(recipesReturn)} backLabel={recipesReturn === 'foods' ? 'Foods' : 'Home'} isPremium={isPremium} freeLimit={FREE_RECIPE_LIMIT} onUpsell={() => setModal({ type: 'paywall', reason: 'recipes' })} t={t} lang={lang} />}
      {foodsMounted.current && <View style={{ flex: 1, display: tab === 'foods' ? 'flex' : 'none' }}>{foodsScreenEl}</View>}
      {planMounted.current && <View style={{ flex: 1, display: tab === 'plan' ? 'flex' : 'none' }}>{planScreenEl}</View>}
      {chatMounted.current && <View style={{ flex: 1, display: tab === 'chat' ? 'flex' : 'none' }}>{chatScreenEl}</View>}

      <TabBar current={tab} setTab={setTab} onPlusPress={() => setModal('logChooser')} t={t} />

      <LogTypeChooserModal visible={modal === 'logChooser'} onClose={() => setModal(null)} onPick={(type) => setModal(type)} t={t} />
      <MealModal visible={modal === 'meal'} onClose={() => setModal(null)} onBarcode={() => setModal('barcode')} onAIScan={openAIScan} onSave={onMealSave} onAddCustomFood={onAddCustomFood} profile={profile} isPremium={isPremium} scansRemaining={scansRemaining} log={log} reintroProgress={reintroProgress} lang={lang} t={t} />
      <SymptomModal visible={modal === 'symptom'} onClose={() => setModal(null)} onSave={(symptom, intensity, when) => { const time = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`; setLog(log.concat([{ id: 's' + Date.now(), type: 'symptom', time, symptom, intensity, timestamp: when.toISOString() }])); setModal(null); setFeedback(logFeedback('symptom', intensity, t)); }} t={t} />
      <SleepModal visible={modal === 'sleep'} onClose={() => setModal(null)} onSave={(hours, when) => { const time = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`; setLog(log.concat([{ id: 'sl' + Date.now(), type: 'sleep', time, hours, timestamp: when.toISOString() }])); setModal(null); setFeedback(logFeedback('sleep', hours, t)); }} t={t} />
      <StressModal visible={modal === 'stress'} onClose={() => setModal(null)} onSave={(level, when) => { const time = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`; setLog(log.concat([{ id: 'st' + Date.now(), type: 'stress', time, level, timestamp: when.toISOString() }])); setModal(null); setFeedback(logFeedback('stress', level, t)); }} t={t} />
      <WaterModal visible={modal === 'water'} onClose={() => setModal(null)} onSave={(glasses, when) => { const time = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`; setLog(log.concat([{ id: 'w' + Date.now(), type: 'water', time, glasses, timestamp: when.toISOString() }])); setModal(null);
        // Celebrate the moment this glass pushes today's total to the daily goal (once per day).
        const dayKey = when.toISOString().slice(0, 10);
        const before = log.filter(e => e.type === 'water' && (e.timestamp || '').slice(0, 10) === dayKey).reduce((a, w) => a + (w.glasses || 0), 0);
        const reachedGoal = before < WATER_GOAL && before + glasses >= WATER_GOAL;
        setFeedback(reachedGoal ? { mood: 'good', art: 'water', emoji: '🎉', title: t('lf_water_goal_title'), message: t('lf_water_goal_msg', { goal: WATER_GOAL, liters: WATER_GOAL_LITERS }) } : logFeedback('water', glasses, t));
      }} t={t} />
      <BarcodeModal visible={modal === 'barcode'} onClose={() => setModal(null)} onComplete={(p, when) => { setModal(null); if (p && when) { const time = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`; setLog(log.concat([{ id: 'b' + Date.now(), type: 'meal', time, items: [], productName: p.name, productRisk: p.risk, timestamp: when.toISOString() }])); showToast(t('toast_product_logged', { name: p.name })); } }} lang={lang} t={t} />
      <AIScanModal visible={modal === 'aiscan'} onClose={() => setModal(null)} scansRemaining={scansRemaining} onComplete={() => { recordScanUsed(); setModal(null); showToast(t('toast_ai_logged')); }} />
      <ScanLimitModal visible={modal === 'scanLimit'} onClose={() => setModal(null)} allowance={PREMIUM_SCANS_PER_MONTH} t={t} />
      <PaywallModal visible={modal === 'paywall' || modal?.type === 'paywall'} reason={modal?.reason} onClose={() => setModal(null)} t={t} onUpgrade={() => { setIsPremium(true); setModal(null); showToast(t('toast_welcome_premium')); if (!user) setTimeout(() => setModal({ type: 'account', mode: 'signup' }), 500); }} />
      <SettingsModal visible={modal === 'settings'} onClose={() => setModal(null)} currentPhase={currentPhase} phaseStartDate={phaseStartDate} onOverride={overridePhaseWeek} profile={profile} setProfile={setProfile} isPremium={isPremium} onUpgrade={() => setModal({ type: 'paywall', reason: null })} onExport={() => { if (isPremium) setModal('export'); else setModal({ type: 'paywall', reason: 'export' }); }} langPref={langPref} setLangPref={setLangPref} onResetApp={() => { setModal(null); resetApp(); }} onSeedDemo={seedDemo} onTogglePremium={() => setIsPremium(p => !p)} onPreviewLevelUp={(opts) => { setModal(null); setTimeout(() => setLevelUp(opts), 350); }} customFoods={customFoods} onUpdateCustomFood={updateCustomFood} onDeleteCustomFood={deleteCustomFood} user={user} onOpenAccount={(mode) => { setModal(null); setTimeout(() => setModal({ type: 'account', mode }), 250); }} onSignOut={signOut} syncing={syncing} lastSync={lastSync} onSync={() => user && syncNow(user.id)} t={t} />
      <AuthModal visible={modal === 'account' || modal?.type === 'account'} initialMode={modal && modal.mode} onClose={() => setModal(null)} user={user} onSignOut={signOut} t={t} />
      <EditEntryModal visible={modal?.type === 'edit'} entry={modal?.entry} onClose={() => setModal(null)} onUpdate={updateLogEntry} onDelete={deleteLogEntry} onLogAgain={(e) => onMealSave(e.items, new Date(), e.mealType, e.mealDishes)} lang={lang} t={t} />
      <HistoryModal visible={modal === 'history'} onClose={() => setModal(null)} log={log} reintroProgress={reintroProgress} onEditEntry={(entry) => setModal({ type: 'edit', entry })} lang={lang} t={t} />
      <PatternsModal visible={modal === 'patterns'} onClose={() => setModal(null)} log={log} lang={lang} t={t} />
      <StartTestModal visible={modal?.type === 'startTest'} categoryId={modal?.categoryId} onClose={() => setModal(null)} onStart={(catId, foodId) => { startReintroTest(catId, foodId); setModal(null); }} t={t} />
      <RecipeDetailModal visible={modal?.type === 'recipe'} recipe={modal?.recipe} onClose={() => setModal(null)} lang={lang} t={t} onLogAsMeal={(recipe) => { onMealSave(recipe.ingredientIds.map(id => makeMealItem(id)), new Date()); }} />
      <ExportModal visible={modal === 'export'} onClose={() => setModal(null)} report={buildDoctorReport({ profile, log, reintroProgress, testHistory, currentPhase, phaseStartDate }, lang)} t={t} />
      <ReintroPromptModal visible={!!pendingReintroPrompt} info={pendingReintroPrompt} onClose={() => setPendingReintroPrompt(null)} onConfirm={(reacted, severity) => {
        if (!activeTest) { setPendingReintroPrompt(null); return; }
        const today = new Date();
        const startDate = new Date(activeTest.startDate);
        const dayNum = Math.min(3, Math.floor((today - startDate) / 86400000) + 1);
        logReintroDay(dayNum, reacted, severity);
        setPendingReintroPrompt(null);
      }} t={t} />
      <ColonyModal visible={modal === 'colony'} onClose={() => setModal(null)} log={log} reintroProgress={reintroProgress} t={t} />
      <ProgressModal visible={modal === 'progress'} onClose={() => setModal(null)} log={log} reintroProgress={reintroProgress} symptomFreeCount={Math.max(0, dayCount - new Set(log.filter(e => e.type === 'symptom').map(sx => (sx.timestamp || '').slice(0, 10))).size)} t={t} />
      <LevelUpCelebration visible={levelUp != null} level={levelUp?.level} complete={levelUp?.complete} onClose={() => setLevelUp(null)} signedIn={!!user} onOpenAccount={() => { setLevelUp(null); setTimeout(() => setModal({ type: 'account', mode: 'signup' }), 300); }} t={t} />
      <LogFeedbackModal feedback={feedback} onClose={() => setFeedback(null)} t={t} />

      {toast && <View style={s.toast} accessibilityLiveRegion="assertive"><Text style={s.toastText}>{toast}</Text></View>}
    </SafeAreaViewSC>
    </SafeAreaProvider>
  );
}

// Onboarding safety screen: IBS-diagnosis fork + red-flag checklist.
// Inform-and-acknowledge model — informs strongly, does not hard-block.
const RED_FLAG_IDS = ['blood','weightloss','newover50','famhistory','anemia','fever','nightwake'];

function SafetyStep({ profile, setProfile, t }) {
  const diagnosed = profile.ibsDiagnosed;
  const redFlags = profile.redFlags || [];
  const setField = (patch) => setProfile(Object.assign({}, profile, patch));
  const toggleFlag = (id) => {
    const next = redFlags.indexOf(id) >= 0 ? redFlags.filter(x => x !== id) : redFlags.concat([id]);
    // if they clear all flags, the acknowledgement is no longer needed
    setField({ redFlags: next, redFlagAck: next.length === 0 ? false : profile.redFlagAck });
  };
  const diagOpts = [{ id: 'yes', label: t('safety_yes') }, { id: 'no', label: t('safety_no') }, { id: 'unsure', label: t('safety_unsure') }];
  const flagItems = RED_FLAG_IDS.map(id => ({ id, label: t('safety_flag_' + id) }));

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
      {/* Diagnosis question */}
      <Text style={{ fontSize: 14, fontWeight: '700', marginBottom: 8 }}>{t('safety_ibs_q')}</Text>
      {diagOpts.map(opt => (
        <TouchableOpacity key={opt.id} onPress={() => setField({ ibsDiagnosed: opt.id })} accessibilityRole="radio" accessibilityState={{ selected: profile.ibsDiagnosed === opt.id }} style={[s.onbOpt, profile.ibsDiagnosed === opt.id && s.onbOptOn]}>
          <Text style={{ flex: 1, fontSize: 15, color: '#2d3a2d' }}>{opt.label}</Text>
          {profile.ibsDiagnosed === opt.id && <View importantForAccessibility="no"><CheckIcon color="#4e7d4e" size={18} /></View>}
        </TouchableOpacity>
      ))}
      {(diagnosed === 'no' || diagnosed === 'unsure') && (
        <View style={{ marginTop: 4, marginBottom: 8, padding: 12, borderRadius: 12, backgroundColor: '#fffbf0', borderWidth: 1, borderColor: '#f0e0b0' }}>
          <Text style={{ fontSize: 12, color: '#7a6a3a', lineHeight: 18 }}>
            {t('safety_no_diag_note')}
          </Text>
        </View>
      )}

      {/* Red flag checklist */}
      <Text style={{ fontSize: 14, fontWeight: '700', marginBottom: 4, marginTop: 16 }}>{t('safety_flags_q')}</Text>
      <Text style={{ fontSize: 12, color: '#6b7a6b', marginBottom: 10, lineHeight: 17 }}>{t('safety_flags_sub')}</Text>
      {flagItems.map(f => {
        const checked = redFlags.indexOf(f.id) >= 0;
        return (
          <TouchableOpacity key={f.id} onPress={() => toggleFlag(f.id)} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={f.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 6, backgroundColor: 'white', borderRadius: 12, borderWidth: 1.5, borderColor: checked ? '#d4a040' : '#c4cec4' }}>
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: checked ? '#d4a040' : '#c0d0c0', backgroundColor: checked ? '#d4a040' : 'white', alignItems: 'center', justifyContent: 'center' }}>
              {checked && <CheckIcon color="white" size={14} />}
            </View>
            <Text style={{ flex: 1, fontSize: 14, color: '#2d3a2d' }}>{f.label}</Text>
          </TouchableOpacity>
        );
      })}

      {/* Red flag warning + required acknowledgement */}
      {redFlags.length > 0 && (
        <View style={{ marginTop: 10, padding: 14, borderRadius: 14, backgroundColor: '#fff4f0', borderWidth: 1.5, borderColor: '#f0d0c0' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#a04030', marginBottom: 6 }}>{t('safety_warn_title')}</Text>
          <Text style={{ fontSize: 12, color: '#6b4030', lineHeight: 18, marginBottom: 12 }}>
            {t('safety_warn_body')}
          </Text>
          <TouchableOpacity onPress={() => setField({ redFlagAck: !profile.redFlagAck })} accessibilityRole="checkbox" accessibilityState={{ checked: !!profile.redFlagAck }} accessibilityLabel={t('safety_warn_ack')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: profile.redFlagAck ? '#4e7d4e' : '#c08070', backgroundColor: profile.redFlagAck ? '#4e7d4e' : 'white', alignItems: 'center', justifyContent: 'center' }}>
              {profile.redFlagAck && <CheckIcon color="white" size={14} />}
            </View>
            <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: '#6b4030' }}>{t('safety_warn_ack')}</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

function OnboardingScreen({ step, setStep, profile, setProfile, onComplete, t }) {
  const steps = [
    { type: 'text', q: "What's your name?", sub: 'Just your first name is fine.', key: 'name', placeholder: 'Your name' },
    { type: 'info', key: '_ibs_info', q: t('onb_ibs_q'), floraMood: 'soso',
      cards: [
        { icon: '🫶', title: t('onb_ibs_card1_title'), body: t('onb_ibs_card1_body') },
        { icon: '⚡', title: t('onb_ibs_card2_title'), body: t('onb_ibs_card2_body') },
        { icon: '💡', title: t('onb_ibs_card3_title'), body: t('onb_ibs_card3_body') },
      ],
    },
    { type: 'safety', q: 'Before we begin', sub: 'A quick health check — this matters.', key: 'safetyAck' },
    { type: 'choice', q: t('onb_menstruate_q'), sub: t('onb_menstruate_sub'), key: 'menstruates', opts: [
      { id: 'yes', icon: '🩸', label: t('onb_menstruate_yes') },
      { id: 'no', icon: '🚫', label: t('onb_menstruate_no') },
    ]},
    { type: 'info', key: '_fodmap_info', q: t('onb_fodmap_q'), floraMood: 'good',
      cards: [
        { icon: '🔬', title: t('onb_fodmap_card1_title'), body: t('onb_fodmap_card1_body') },
        { icon: '🥬', title: t('onb_fodmap_card2_title'), body: t('onb_fodmap_card2_body') },
        { icon: '🗓️', title: t('onb_fodmap_card3_title'), body: t('onb_fodmap_card3_body') },
      ],
    },
    { type: 'choice', q: t('onb_phase_q'), sub: t('onb_phase_sub'), key: 'phase', opts: [
      { id: 'learning', icon: '📚', label: t('onb_phase_learning') },
      { id: 'curious', icon: '🤔', label: t('onb_phase_curious') },
      { id: 'elimination', icon: '🥬', label: t('onb_phase_elimination') },
      { id: 'reintro', icon: '🧪', label: t('onb_phase_reintro') },
      { id: 'maintenance', icon: '✅', label: t('onb_phase_maintenance') },
    ]},
    { type: 'choice', q: t('onb_symptom_q'), sub: t('onb_symptom_sub'), key: 'symptom', opts: [
      { id: 'bloat', icon: '🎈', label: t('onb_symptom_bloat') },
      { id: 'pain', icon: '⚡', label: t('onb_symptom_pain') },
      { id: 'bowel', icon: '🔁', label: t('onb_symptom_bowel') },
      { id: 'multi', icon: '🌪️', label: t('onb_symptom_multi') },
    ]},
    { type: 'multi', q: t('onb_known_q'), sub: t('onb_known_sub'), key: 'known', opts: [
      { id: 'lactose', icon: '🥛', label: t('onb_known_lactose') },
      { id: 'gluten', icon: '🌾', label: t('onb_known_gluten') },
      { id: 'fructose', icon: '🍎', label: t('onb_known_fructose') },
      { id: 'histamine', icon: '🌡️', label: t('onb_known_histamine') },
      { id: 'unknown', icon: '❓', label: t('onb_known_unknown') },
    ]},
    { type: 'choice', q: t('onb_sleep_q'), sub: t('onb_sleep_sub'), key: 'sleep', opts: [
      { id: 'great', icon: '😴', label: t('onb_sleep_great') },
      { id: 'okay', icon: '🛌', label: t('onb_sleep_okay') },
      { id: 'poor', icon: '😵', label: t('onb_sleep_poor') },
    ]},
    { type: 'choice', q: t('onb_stress_q'), sub: t('onb_stress_sub'), key: 'stress', opts: [
      { id: 'low', icon: '🧘', label: t('onb_stress_low') },
      { id: 'mid', icon: '🌀', label: t('onb_stress_mid') },
      { id: 'high', icon: '🔥', label: t('onb_stress_high') },
    ]},
  ];

  const current = steps[step];
  if (!current) { onComplete(); return null; }
  const value = profile[current.key];
  // Safety step: can continue only once the user has answered the diagnosis question
  // AND, if they ticked any red flag, actively acknowledged it.
  const redFlags = profile.redFlags || [];
  const safetyOk = profile.ibsDiagnosed !== undefined && (redFlags.length === 0 || profile.redFlagAck === true);
  const canContinue = current.type === 'safety' ? safetyOk
    : current.type === 'info' ? true
    : current.type === 'text' ? (value && value.length > 0)
    : current.type === 'multi' ? (value && value.length > 0)
    : value !== undefined;

  const select = (id) => {
    if (current.type === 'multi') {
      const cur = profile[current.key] || [];
      setProfile(Object.assign({}, profile, { [current.key]: cur.includes(id) ? cur.filter(x => x !== id) : cur.concat([id]) }));
    } else {
      setProfile(Object.assign({}, profile, { [current.key]: id }));
    }
  };

  return (
    <SafeAreaProvider>
    <SafeAreaViewSC style={s.root} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={THEME.bg} />
      <KeyboardAvoidingView style={{ flex: 1, padding: 20 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 6 }}>
        <View style={{ width: 32, height: 32, justifyContent: 'center', marginLeft: -4 }}>
          {step > 0 && (
            <TouchableOpacity onPress={() => setStep(step - 1)} accessibilityRole="button" accessibilityLabel={t('back')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <IconArrowLeft size={24} color={THEME.ink} />
            </TouchableOpacity>
          )}
        </View>
        <View style={{ flex: 1, height: 4, backgroundColor: '#e0e8e0', borderRadius: 2, overflow: 'hidden', marginRight: 44 }}>
          <View style={{ height: 4, backgroundColor: '#4e7d4e', width: `${((step + 1) / steps.length) * 100}%` }} />
        </View>
      </View>
      <Text style={{ fontSize: 11, color: '#647264', marginBottom: 24, marginLeft: 44 }}>{t('onb_step', { n: step + 1, total: steps.length })}</Text>
      {step === 0 && (
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <Flora size={120} />
          <Text style={{ fontSize: 13, color: THEME.textMuted, marginTop: 6 }}>{t('onb_flora_intro')}</Text>
        </View>
      )}
      {current.type === 'info' ? (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <Flora size={100} mood={current.floraMood} />
          </View>
          <Text style={{ fontSize: 26, fontWeight: '700', letterSpacing: -0.5, marginBottom: 20 }}>{current.q}</Text>
          {current.cards.map((card, i) => (
            <Surface key={i} elevation={1} primaryColor={THEME.primary} style={{ backgroundColor: THEME.card, borderRadius: THEME.rCard, padding: 16, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <Text style={{ fontSize: 22 }}>{card.icon}</Text>
                <Text style={{ fontSize: 15, fontWeight: '700', color: THEME.ink, flex: 1 }}>{card.title}</Text>
              </View>
              <Text style={{ fontSize: 14, color: '#5e7060', lineHeight: 21 }}>{card.body}</Text>
            </Surface>
          ))}
          <View style={{ height: 12 }} />
        </ScrollView>
      ) : (
        <>
          <Text style={{ fontSize: 26, fontWeight: '700', letterSpacing: -0.5, marginBottom: 8 }}>{current.q}</Text>
          <Text style={{ fontSize: 14, color: '#6b7a6b', marginBottom: 24, lineHeight: 20 }}>{current.sub}</Text>
          {current.type === 'text' ? (
            <View style={{ flex: 1 }}>
              <TextInput accessibilityLabel={current.q} value={value || ''} onChangeText={(t) => setProfile(Object.assign({}, profile, { [current.key]: t }))} placeholder={current.placeholder} placeholderTextColor="#6b7a6b" autoFocus style={{ backgroundColor: 'white', borderRadius: 16, padding: 18, fontSize: 18, borderWidth: 1.5, borderColor: '#c4cec4' }} />
            </View>
          ) : current.type === 'safety' ? (
            <SafetyStep profile={profile} setProfile={setProfile} t={t} />
          ) : (
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              {current.opts.map(opt => {
                const isSel = current.type === 'multi' ? (value || []).includes(opt.id) : value === opt.id;
                return (
                  <TouchableOpacity key={opt.id} onPress={() => select(opt.id)} accessibilityRole={current.type === 'multi' ? 'checkbox' : 'radio'} accessibilityState={{ checked: isSel, selected: isSel }} accessibilityLabel={opt.label} style={[s.onbOpt, isSel && s.onbOptOn]}>
                    <Text importantForAccessibility="no" style={{ fontSize: 22 }}>{opt.icon}</Text>
                    <Text style={{ flex: 1, fontSize: 15, color: '#2d3a2d' }}>{opt.label}</Text>
                    {isSel && <View importantForAccessibility="no"><CheckIcon color="#4e7d4e" size={18} /></View>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </>
      )}
      <TouchableOpacity onPress={() => step < steps.length - 1 ? setStep(step + 1) : onComplete()} disabled={!canContinue} style={[s.btnPrimary, !canContinue && { backgroundColor: '#c0d0c0' }]}>
        <Text style={s.btnPrimaryText}>{step === steps.length - 1 ? t('onb_start') : t('continue')}</Text>
      </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaViewSC>
    </SafeAreaProvider>
  );
}

// Rounded risk badge (Low / Moderate / High) — the recurring food-risk chip
// used across the timeline and food list.
function RiskPill({ cat, t }) {
  const col = CAT_COLORS[cat] || CAT_COLORS.low;
  const label = t ? (cat === 'mod' ? t('risk_moderate') : cat === 'high' ? t('risk_high') : t('risk_low')) : (cat === 'mod' ? 'Moderate' : cat === 'high' ? 'High' : 'Low');
  return (
    <View style={{ backgroundColor: col.bg, borderRadius: THEME.rPill, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color: col.text, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

// Single small metric tile (sleep / stress / meals) used in the hero row.
function MetricTile({ value, unit, label, icon, flat = false }) {
  // Fixed-height value zone (56 = the Low FODMAP tile's ScoreRing size) so this tile's label
  // lands at the same vertical position as the ring tile's label, regardless of icon/no-icon.
  const content = (
    <>
      <View style={{ height: 56, alignItems: 'center', justifyContent: 'center' }}>
        {icon ? <Text style={{ fontSize: 15, marginBottom: 4 }}>{icon}</Text> : null}
        <Text style={{ fontSize: 30, fontWeight: '800', color: THEME.ink, lineHeight: 32 }}>
          {value}{unit ? <Text style={{ fontSize: 16, fontWeight: '700' }}>{unit}</Text> : null}
        </Text>
      </View>
      <Text style={{ fontSize: 12, color: THEME.textSoft, marginTop: 8, fontWeight: '600' }}>{label}</Text>
    </>
  );
  // flat = outlined variant (no shadow, real border) — stays a plain View, no Surface needed.
  if (flat) {
    return (
      <View style={{ flex: 1, backgroundColor: THEME.card, borderRadius: THEME.rCard, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: THEME.cardBorder }}>
        {content}
      </View>
    );
  }
  return (
    <Surface elevation={1} tinted={false} style={{ flex: 1, backgroundColor: THEME.card, borderRadius: THEME.rCard, paddingVertical: 16, alignItems: 'center' }}>
      {content}
    </Surface>
  );
}

// Stats-forward hero: a Google-Fit-style "gut score" ring plus today's
// adherence/symptom bars and quick metric tiles. The score is derived only from
// what the app actually tracks — low-FODMAP adherence and symptom load today —
// so it stays honest rather than inventing a number.
// Derive today's reactive numbers + Flora mood/form from the log. Used by the
// Today hero (mascot mood) and the stats sheet below it.
function homeStats(log, reintroProgress, symptomFreeCount, t) {
  const form = floraForm(computeGamification(log, reintroProgress).level);
  const todayKey = new Date().toISOString().slice(0, 10);
  const today = log.filter(e => (e.timestamp || '').slice(0, 10) === todayKey);
  const todayMeals = today.filter(e => e.type === 'meal');
  const todaySymptoms = today.filter(e => e.type === 'symptom');
  const lastSleep = today.filter(e => e.type === 'sleep').slice(-1)[0];

  let lowCount = 0;
  todayMeals.forEach(m => {
    const cat = m.productRisk ? m.productRisk : categorizeMeal(m.items || [], reintroProgress).overall;
    if (cat === 'low') lowCount++;
  });
  const adherence = todayMeals.length ? lowCount / todayMeals.length : null;
  const adherencePct = adherence != null ? Math.round(adherence * 100) : null;

  // Compose a 0–100 gut score; null until there's something to score today.
  let score = null;
  if (todayMeals.length || todaySymptoms.length) {
    const base = adherence != null ? adherence * 100 : 70;
    const symPenalty = todaySymptoms.reduce((a, sx) => a + (sx.intensity || 0) * 4, 0);
    score = Math.max(5, Math.min(100, Math.round(base - symPenalty)));
  }
  const { mood, title, sub } = moodFromScore(score, symptomFreeCount, t);
  const ringColor = score == null ? THEME.textMuted : score >= 75 ? THEME.primary : score >= 50 ? THEME.amber : THEME.red;
  return {
    form, mood, title, sub, adherencePct, ringColor,
    symptomsCount: todaySymptoms.length,
    sleep: lastSleep ? lastSleep.hours : '—',
    sleepUnit: lastSleep ? 'h' : '',
    waterGlasses: today.filter(e => e.type === 'water').reduce((a, w) => a + (w.glasses || 0), 0),
  };
}

// The gamification hero: Flora's evolving form + a growing colony of friends,
// fed by the four point sources. Tapping it opens a breakdown of how to earn more.
function ColonyCard({ log, reintroProgress, onOpenBreakdown, t }) {
  const g = computeGamification(log, reintroProgress);
  const form = floraForm(g.level);
  const complete = g.colonySize >= 12;
  const streak = complete ? calmStreak(log) : 0;

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onOpenBreakdown} style={{ marginHorizontal: 20, marginBottom: 12 }}>
      <View style={[s.sectionHeader, { marginHorizontal: 0 }]}>
        <Text accessibilityRole="header" style={s.sectionTitle}>{t('home_colony_title')}</Text>
        <Text style={s.sectionLink}>{t('home_see_colony')}</Text>
      </View>
      <View style={{ backgroundColor: '#dcebdc', borderRadius: THEME.rCard, padding: 18 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'white', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
            {complete && <CheckIcon color={THEME.primaryDark} size={12.5} />}
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: THEME.primaryDark }}>{complete ? t('home_colony_complete') : t('colony_lv', { n: g.level, form: t('colony_form_' + form) })}</Text>
          </View>
        </View>

        <View style={{ marginVertical: 6, marginBottom: 16 }}>
          <ColonyCluster size={56} colonySize={g.colonySize} centered />
        </View>

        {complete ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'white', borderRadius: 16, paddingVertical: 13, paddingHorizontal: 15 }}>
            <Text style={{ fontSize: 22 }}>🔥</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#2d6a2d' }}>{t('home_days_thriving', { n: streak, unit: streak === 1 ? t('home_day') : t('home_days') })}</Text>
              <Text style={{ fontSize: 12.5, color: THEME.textSoft, marginTop: 1 }}>{t('home_colony_thriving')}</Text>
            </View>
          </View>
        ) : (
          <View style={{ backgroundColor: 'white', borderRadius: 16, paddingVertical: 13, paddingHorizontal: 15 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 }}>
              <Text style={{ fontSize: 12.5, color: THEME.textSoft }}>{t('colony_pts', { n: g.points })}</Text>
              <Text style={{ fontSize: 12.5, color: THEME.ink, fontWeight: '700' }}>{t('home_to_level', { n: g.level + 1 })}</Text>
            </View>
            <View style={{ height: 8, backgroundColor: '#e2efe0', borderRadius: 5, overflow: 'hidden' }}>
              <View style={{ height: 8, backgroundColor: THEME.primary, width: `${g.pointsIntoLevel}%`, borderRadius: 5 }} />
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// A full-screen panel that pushes in from the right (iOS-style forward nav) and
// slides back out on close — used for detail screens reached by tapping.
function SlideOverModal({ visible, onClose, children }) {
  const tx = useRef(new Animated.Value(width)).current;
  const [rendered, setRendered] = useState(visible);
  useEffect(() => {
    if (visible) {
      setRendered(true);
      if (_reduceMotion) { tx.setValue(0); return; }
      Animated.timing(tx, { toValue: 0, duration: 290, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else if (rendered) {
      if (_reduceMotion) { tx.setValue(width); setRendered(false); return; }
      Animated.timing(tx, { toValue: width, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => { if (finished) setRendered(false); });
    }
  }, [visible]);
  if (!rendered) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View accessibilityViewIsModal style={{ flex: 1, transform: [{ translateX: tx }] }}>
        {children}
      </Animated.View>
    </Modal>
  );
}

// Bottom-sheet modal: the dark backdrop fades in place while only the panel slides up from the
// bottom. (Native animationType="slide" on a transparent modal slides the dim too, which reads
// as the dim "moving".) Honours Reduce Motion; tapping the backdrop closes it.
function BottomSheet({ visible, onClose, children }) {
  const [rendered, setRendered] = useState(visible);
  const backdrop = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const H = Dimensions.get('window').height;
  useEffect(() => {
    if (visible) {
      setRendered(true);
      ty.setValue(H);
      if (_reduceMotion) { backdrop.setValue(1); ty.setValue(0); return; }
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(ty, { toValue: 0, friction: 12, tension: 80, useNativeDriver: true }),
      ]).start();
    } else if (rendered) {
      if (_reduceMotion) { backdrop.setValue(0); setRendered(false); return; }
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(ty, { toValue: H, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setRendered(false); });
    }
  }, [visible]);
  if (!rendered) return null;
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,33,15,0.45)', opacity: backdrop }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} accessibilityRole="button" accessibilityLabel={tG('close')} />
        </Animated.View>
        <Animated.View style={{ transform: [{ translateY: ty }] }}>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

// Material-3-style top app bar for screens with a back button. `variant`:
// 'large' (default in GutBloom) puts a big headline on a second row; 'small' keeps
// the title inline. `right` renders optional trailing actions.
function AppBar({ title, onBack, variant = 'large', right = null, backIcon = 'arrow-back', t }) {
  const back = onBack ? (
    <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel={t ? (backIcon === 'close' ? t('close') : t('back')) : (backIcon === 'close' ? 'Close' : 'Back')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
      {backIcon === 'close' ? <IconX size={24} color={THEME.ink} /> : <IconArrowLeft size={24} color={THEME.ink} />}
    </TouchableOpacity>
  ) : <View style={{ width: 12 }} />;

  if (variant === 'small') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 56, paddingRight: 8 }}>
        {back}
        <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, fontSize: 20, fontWeight: '700', color: THEME.ink }}>{title}</Text>
        {right}
      </View>
    );
  }
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 56, paddingRight: 8 }}>
        {back}
        <View style={{ flex: 1 }} />
        {right}
      </View>
      <Text accessibilityRole="header" numberOfLines={1} style={{ fontSize: 28, fontWeight: '700', color: THEME.ink, letterSpacing: -0.5, paddingHorizontal: 16, paddingBottom: 16 }}>{title}</Text>
    </View>
  );
}

// Full-screen breakdown of the colony: current form, level progress, and how
// each of the four point sources contributed.
function ColonyModal({ visible, onClose, log, reintroProgress, t }) {
  const g = computeGamification(log, reintroProgress);
  const form = floraForm(g.level);
  const complete = g.colonySize >= 12;
  const streak = complete ? calmStreak(log) : 0;
  const rows = [
    { icon: '🌿', label: t('colony_row_symFree'), pts: g.breakdown.symptomFree, how: t('colony_row_symFree_how') },
    { icon: '🥗', label: t('colony_row_meals'), pts: g.breakdown.adherence, how: t('colony_row_meals_how') },
    { icon: '✍️', label: t('colony_row_logging'), pts: g.breakdown.logging, how: t('colony_row_logging_how') },
    { icon: '🧪', label: t('colony_row_reintro'), pts: g.breakdown.reintro, how: t('colony_row_reintro_how') },
  ];
  return (
    <SlideOverModal visible={visible} onClose={onClose}>
      <SafeAreaViewSC style={{ flex: 1, backgroundColor: THEME.bg }}>
        <AppBar title={t('colony_title')} onBack={onClose} t={t} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <Flora size={140} mood="good" form={form} />
            {complete ? (
              <>
                <Text style={{ fontSize: 22, fontWeight: '700', color: THEME.ink, marginTop: 8 }}>{t('colony_thriving')}</Text>
                <Text style={{ fontSize: 13, color: THEME.textMuted, marginTop: 2 }}>{t('colony_points_all', { n: g.points })}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e8f0e8', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, marginTop: 12 }}>
                  <Text style={{ fontSize: 15 }}>🔥</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#2d6a2d' }}>{t('home_days_thriving', { n: streak, unit: streak === 1 ? t('home_day') : t('home_days') })}</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 22, fontWeight: '700', color: THEME.ink, marginTop: 8 }}>{tG('colony_level_form', { n: g.level, form: tG('colony_form_' + form) })}</Text>
                <Text style={{ fontSize: 13, color: THEME.textMuted, marginTop: 2 }}>{t('colony_points', { n: g.points, to: g.toNext, next: g.level + 1 })}</Text>
                <View style={{ width: '80%', height: 10, backgroundColor: '#dceadc', borderRadius: 6, overflow: 'hidden', marginTop: 12 }}>
                  <View style={{ height: 10, backgroundColor: THEME.primary, width: `${g.pointsIntoLevel}%`, borderRadius: 6 }} />
                </View>
              </>
            )}
          </View>

          <View style={{ marginVertical: 18, paddingHorizontal: 8 }}>
            <ColonyCluster size={58} colonySize={g.colonySize} centered />
          </View>

          <Text style={{ fontSize: 14, fontWeight: '700', color: THEME.ink, marginBottom: 10 }}>{t('colony_earned')}</Text>
          {rows.map((r, i) => (
            <View key={i} style={[s.cardOutlined, { marginHorizontal: 0, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
              <Text style={{ fontSize: 24 }}>{r.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: THEME.ink }}>{r.label}</Text>
                <Text style={{ fontSize: 12, color: THEME.textMuted, marginTop: 2 }}>{r.how}</Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: '700', color: THEME.primaryDark }}>{r.pts}</Text>
            </View>
          ))}
          <Text style={{ fontSize: 12, color: '#5e7060', textAlign: 'center', marginTop: 8, lineHeight: 18 }}>
            {t('colony_footer')}
          </Text>
          <View style={{ height: 30 }} />
        </ScrollView>
      </SafeAreaViewSC>
    </SlideOverModal>
  );
}

// Celebratory overlay shown when Flora levels up: she springs in while a
// ring of sparkles bursts outward. Driven by the Animated API (no deps).
function LevelUpCelebration({ visible, level, complete, onClose, signedIn, onOpenAccount, t }) {
  const scale = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      if (_reduceMotion) { scale.setValue(1); burst.setValue(1); return; }
      scale.setValue(0); burst.setValue(0);
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
        Animated.timing(burst, { toValue: 1, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }
  }, [visible, level]);
  if (!visible) return null;
  const form = complete ? 'thriving' : floraForm(level);
  // Each level adds one colony microbe; the newest is at index (colonySize-1).
  const colonyNow = Math.max(0, Math.min(12, level - 1));
  const newSpecies = (((colonyNow - 1) % 6) + 6) % 6;
  const sparkles = [0, 1, 2, 3, 4, 5].map(i => {
    const ang = (i / 6) * 2 * Math.PI;
    const tx = burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(ang) * (complete ? 88 : 74)] });
    const ty = burst.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(ang) * (complete ? 88 : 74)] });
    const op = burst.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
    return <Animated.Text key={i} style={{ position: 'absolute', fontSize: 20, opacity: op, transform: [{ translateX: tx }, { translateY: ty }] }}>✨</Animated.Text>;
  });
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 30 }}>
        <Animated.View accessibilityViewIsModal style={{ transform: [{ scale }], alignSelf: 'stretch' }}>
        <Surface elevation={3} primaryColor={THEME.primary} style={{ backgroundColor: THEME.card, borderRadius: 24, padding: 28, alignItems: 'center' }}>
          <View style={{ width: 140, height: 140, alignItems: 'center', justifyContent: 'center' }}>
            {sparkles}
            {complete
              ? <Flora size={120} mood="good" form={form} />
              : <MiniMicrobe size={96} variant={newSpecies} />}
          </View>
          {complete ? (
            <>
              <Text style={{ fontSize: 13, fontWeight: '700', color: THEME.primaryDark, letterSpacing: 1, marginTop: 6 }}>{t('levelup_badge_complete')}</Text>
              <Text style={{ fontSize: 23, fontWeight: '700', color: THEME.ink, marginTop: 2, textAlign: 'center' }}>{t('levelup_title_complete')}</Text>
              <View style={{ marginTop: 14, marginBottom: 2 }}>
                <ColonyCluster size={34} colonySize={12} centered />
              </View>
              <Text style={{ fontSize: 13, color: THEME.textMuted, marginTop: 12, textAlign: 'center', lineHeight: 19 }}>{t('levelup_body_complete')}</Text>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 13, fontWeight: '700', color: THEME.primaryDark, letterSpacing: 1, marginTop: 6 }}>{t('levelup_member_badge')}</Text>
              <Text style={{ fontSize: 24, fontWeight: '700', color: THEME.ink, marginTop: 2 }}>{t('levelup_title', { n: level })}</Text>
              <Text style={{ fontSize: 13, color: THEME.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>{t('levelup_member_body')}</Text>
              <View style={{ marginTop: 16, alignSelf: 'stretch', backgroundColor: '#f5faf5', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 14 }}>
                <ColonyCluster size={30} colonySize={colonyNow} centered />
              </View>
            </>
          )}
          <TouchableOpacity onPress={onClose} style={[s.btnPrimary, { alignSelf: 'stretch', marginTop: 20 }]}><Text style={s.btnPrimaryText}>{t('levelup_btn')}</Text></TouchableOpacity>
          {!signedIn && (
            <TouchableOpacity onPress={onOpenAccount} accessibilityRole="button" style={{ marginTop: 14, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: THEME.primary }}>{t('levelup_save_cta')}</Text>
            </TouchableOpacity>
          )}
        </Surface>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── LOG FEEDBACK ────────────────────────────────────────────────────────
// After each log entry we give instant, character-led feedback: Flora reacts
// (good / so-so / bad) with a context emoji and a short, kind message tailored
// to the entry type. Encouraging on good days, supportive — never scolding —
// on bad ones.
function logFeedback(kind, value, t) {
  if (kind === 'meal') {
    if (value === 'low') return { mood: 'good', emoji: '🥗', title: t('lf_meal_low_title'), message: t('lf_meal_low_msg') };
    if (value === 'mod') return { mood: 'soso', emoji: '🍽️', title: t('lf_meal_mod_title'), message: t('lf_meal_mod_msg') };
    return { mood: 'bad', emoji: '🌶️', title: t('lf_meal_high_title'), message: t('lf_meal_high_msg') };
  }
  if (kind === 'symptom') {
    if (value >= 3) return { mood: 'bad', emoji: '💛', title: t('lf_symptom_high_title'), message: t('lf_symptom_high_msg') };
    return { mood: 'soso', emoji: '📝', title: t('lf_symptom_low_title'), message: t('lf_symptom_low_msg') };
  }
  if (kind === 'sleep') {
    if (value >= 7) return { mood: 'good', emoji: '😴', title: t('lf_sleep_great_title'), message: t('lf_sleep_great_msg') };
    if (value >= 6) return { mood: 'soso', emoji: '🛌', title: t('lf_sleep_ok_title'), message: t('lf_sleep_ok_msg') };
    return { mood: 'bad', emoji: '🥱', title: t('lf_sleep_short_title'), message: t('lf_sleep_short_msg') };
  }
  if (kind === 'stress') {
    if (value <= 2) return { mood: 'good', emoji: '🧘', title: t('lf_stress_low_title'), message: t('lf_stress_low_msg') };
    if (value === 3) return { mood: 'soso', emoji: '🌀', title: t('lf_stress_mid_title'), message: t('lf_stress_mid_msg') };
    return { mood: 'bad', emoji: '😮‍💨', title: t('lf_stress_high_title'), message: t('lf_stress_high_msg') };
  }
  if (kind === 'water') {
    return { mood: 'good', emoji: '💧', title: t('lf_water_title'), message: t('lf_water_msg') };
  }
  return null;
}

// A dedicated, more playful illustration for hitting the daily water goal: Flora beaming
// inside a big water droplet, ringed by bubbles and sparkles. Used by LogFeedbackModal.
function WaterGoalArt({ size = 140 }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 150 150" style={{ position: 'absolute' }}>
        <Circle cx="75" cy="86" r="66" fill="#eaf4fc" />
        <Path d="M75 20 C 75 20 40 72 40 96 a 35 35 0 1 0 70 0 C 110 72 75 20 75 20 Z" fill="#cfe6f9" stroke="#5aa0e0" strokeWidth="2.5" />
        <Path d="M58 98 a 15 18 0 0 0 8 24" stroke="#ffffff" strokeWidth="4.5" fill="none" strokeLinecap="round" opacity="0.85" />
        <Circle cx="114" cy="110" r="6" fill="#bcdcf5" stroke="#5aa0e0" strokeWidth="1.5" />
        <Circle cx="32" cy="118" r="4.5" fill="#bcdcf5" stroke="#5aa0e0" strokeWidth="1.5" />
        <Path d="M124 42 l2.4 6.6 6.6 2.4 -6.6 2.4 -2.4 6.6 -2.4 -6.6 -6.6 -2.4 6.6 -2.4 z" fill="#f0bd4f" />
        <Path d="M22 52 l1.8 5 5 1.8 -5 1.8 -1.8 5 -1.8 -5 -5 -1.8 5 -1.8 z" fill="#5fb06a" />
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', paddingTop: size * 0.4 }}>
        <Flora size={size * 0.46} mood="good" />
      </View>
    </View>
  );
}

function LogFeedbackModal({ feedback, onClose, t }) {
  const scale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (feedback) {
      scale.setValue(0);
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }).start();
    }
  }, [feedback]);
  if (!feedback) return null;
  const halo = feedback.mood === 'good' ? '#e3f1e3' : feedback.mood === 'bad' ? '#fde0e0' : '#fbeed3';
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 30 }}>
        <Animated.View accessibilityViewIsModal style={{ transform: [{ scale }], alignSelf: 'stretch' }}>
        <Surface elevation={3} primaryColor={THEME.primary} style={{ backgroundColor: THEME.card, borderRadius: 24, padding: 26, alignItems: 'center' }}>
          {feedback.art === 'water' ? (
            <WaterGoalArt size={140} />
          ) : (
            <View style={{ width: 132, height: 132, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: halo }} />
              <Flora size={110} mood={feedback.mood} />
              <View style={{ position: 'absolute', bottom: 4, right: 8, width: 42, height: 42, borderRadius: 21, backgroundColor: 'white', borderWidth: 1, borderColor: THEME.cardBorder, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 22 }}>{feedback.emoji}</Text>
              </View>
            </View>
          )}
          <Text style={{ fontSize: 20, fontWeight: '700', color: THEME.ink, marginTop: 12 }}>{feedback.title}</Text>
          <Text style={{ fontSize: 13, color: THEME.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 19 }}>{feedback.message}</Text>
          <TouchableOpacity onPress={onClose} style={[s.btnPrimary, { alignSelf: 'stretch', marginTop: 18 }]}><Text style={s.btnPrimaryText}>{t('lf_got_it')}</Text></TouchableOpacity>
        </Surface>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── PROGRESS / STATS ────────────────────────────────────────────────────
// A simple, dependency-free 7-day bar chart built from React Native Views, so
// it renders identically everywhere and needs no charting library.
function WeeklyBars({ data, color, max, height = 100 }) {
  const peak = max || Math.max(1, ...data.map(d => d.value));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height }}>
      {data.map((d, i) => {
        const isToday = i === data.length - 1;
        const h = d.value > 0 ? Math.max(5, (d.value / peak) * (height - 26)) : 4;
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 10, color: isToday ? THEME.ink : THEME.textMuted, fontWeight: isToday ? '700' : '400', marginBottom: 4, height: 13 }}>{d.value > 0 ? (d.display ?? d.value) : ''}</Text>
            <View style={{ width: 20, height: h, backgroundColor: d.value > 0 ? (isToday ? color : color + '70') : '#eef2ee', borderRadius: 6 }} />
            <Text style={{ fontSize: 11, color: isToday ? THEME.ink : THEME.textMuted, fontWeight: isToday ? '700' : '400', marginTop: 6 }}>{(d.label || '').charAt(0)}</Text>
          </View>
        );
      })}
    </View>
  );
}

// Builds the last `n` calendar days (oldest→newest) with per-day buckets.
const WATER_GOAL = 10; // glasses/day — 10 × 200 ml ≈ 2 L, a common hydration target
const WATER_GLASS_ML = 200; // 1 glass ≈ 200 ml → a 10-glass goal ≈ 2 L/day
const WATER_GOAL_LITERS = (WATER_GOAL * WATER_GLASS_ML) / 1000; // 2

function buildDailySeries(log, n, reintroProgress) {
  const days = [];
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    const key = dt.toISOString().slice(0, 10);
    const entries = (log || []).filter(e => (e.timestamp || '').slice(0, 10) === key);
    const meals = entries.filter(e => e.type === 'meal');
    let low = 0;
    meals.forEach(m => {
      const cat = m.productRisk ? m.productRisk : categorizeMeal(m.items || [], reintroProgress).overall;
      if (cat === 'low') low++;
    });
    const sleep = entries.filter(e => e.type === 'sleep').slice(-1)[0];
    days.push({
      label: dow[dt.getDay()],
      symptoms: entries.filter(e => e.type === 'symptom').length,
      adherence: meals.length ? Math.round((low / meals.length) * 100) : null,
      sleep: sleep ? sleep.hours : 0,
      water: entries.filter(e => e.type === 'water').reduce((a, w) => a + (w.glasses || 0), 0),
      mealCount: meals.length,
    });
  }
  return days;
}

function ProgressModal({ visible, onClose, log, reintroProgress, symptomFreeCount, t }) {
  const series = buildDailySeries(log, 7, reintroProgress);
  const g = computeGamification(log, reintroProgress);
  const adherenceDays = series.filter(d => d.adherence != null);
  const avgAdherence = adherenceDays.length ? Math.round(adherenceDays.reduce((a, d) => a + d.adherence, 0) / adherenceDays.length) : null;
  const sleepDays = series.filter(d => d.sleep > 0);
  const avgSleep = sleepDays.length ? (sleepDays.reduce((a, d) => a + d.sleep, 0) / sleepDays.length).toFixed(1) : '—';
  const waterDays = series.filter(d => d.water > 0);
  const avgWater = waterDays.length ? (waterDays.reduce((a, d) => a + d.water, 0) / waterDays.length).toFixed(1) : '—';
  const weekSymptoms = series.reduce((a, d) => a + d.symptoms, 0);
  const symptomFreeThisWeek = series.filter(d => (d.mealCount > 0 || d.symptoms > 0) && d.symptoms === 0).length;

  // Weekly gut score = average of each day's score (adherence minus symptom load).
  const dayScores = series.map(d => {
    if (d.adherence == null && d.symptoms === 0) return null;
    const base = d.adherence != null ? d.adherence : 70;
    return Math.max(5, Math.min(100, Math.round(base - d.symptoms * 12)));
  }).filter(x => x != null);
  const weekScore = dayScores.length ? Math.round(dayScores.reduce((a, x) => a + x, 0) / dayScores.length) : null;
  const scoreColor = weekScore == null ? THEME.textMuted : weekScore >= 75 ? THEME.primary : weekScore >= 50 ? THEME.amber : THEME.red;
  const scoreWord = weekScore == null ? t('progress_score_null') : weekScore >= 75 ? t('progress_score_good') : weekScore >= 50 ? t('progress_score_mid') : t('progress_score_bad');

  return (
    <SlideOverModal visible={visible} onClose={onClose}>
      <SafeAreaViewSC style={{ flex: 1, backgroundColor: '#e7f3df' }}>
        <AppBar title={t('progress_title')} onBack={onClose} t={t} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
          <View style={[s.cardFilled, { marginHorizontal: 0, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: THEME.card }]}>
            <Flora size={56} mood="good" form={floraForm(g.level)} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: THEME.ink }}>{tG('progress_level_points', { level: g.level, points: g.points })}</Text>
              <Text style={{ fontSize: 12, color: THEME.textMuted, marginTop: 2 }}>{t('progress_flora_body')}</Text>
            </View>
          </View>
          {/* Hero ring — the week at a glance (Google Fit style) */}
          <View style={[s.cardOutlined, { marginHorizontal: 0, alignItems: 'center', paddingTop: 24, paddingBottom: 20 }]}>
            <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 1, color: THEME.textMuted, marginBottom: 14 }}>{t('progress_last7')}</Text>
            <ScoreRing value={weekScore || 0} size={150} stroke={13} color={scoreColor} centerValue={weekScore == null ? '—' : weekScore} centerLabel={t('progress_gut_score')} />
            <Text style={{ fontSize: 14, color: THEME.textSoft, marginTop: 14, textAlign: 'center' }}>{scoreWord}</Text>
          </View>

          {/* Metric summary cards */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 4 }}>
            <View style={{ width: '48%' }}><MetricTile flat icon="🌿" value={symptomFreeThisWeek} label={t('progress_calm_days')} /></View>
            <View style={{ width: '48%' }}><MetricTile flat icon="🥗" value={avgAdherence == null ? '—' : `${avgAdherence}%`} label={t('progress_adherence')} /></View>
            <View style={{ width: '48%' }}><MetricTile flat icon="😴" value={avgSleep} unit={avgSleep === '—' ? '' : 'h'} label={t('progress_avg_sleep')} /></View>
            <View style={{ width: '48%' }}><MetricTile flat icon="💧" value={avgWater} label={t('progress_avg_water')} /></View>
          </View>

          <View style={[s.cardOutlined, { marginHorizontal: 0, marginTop: 12 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text accessibilityRole="header" style={{ fontSize: 15, fontWeight: '700', color: THEME.ink }}>{t('progress_adherence_title')}</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: THEME.primary }}>{avgAdherence == null ? '—' : `${avgAdherence}%`}</Text>
            </View>
            <Text style={{ fontSize: 12, color: THEME.textMuted, marginTop: 2, marginBottom: 16 }}>{t('progress_adherence_sub')}</Text>
            <WeeklyBars data={series.map(d => ({ label: d.label, value: d.adherence || 0, display: d.adherence != null ? `${d.adherence}%` : '' }))} color={THEME.primary} max={100} />
          </View>

          <View style={[s.cardOutlined, { marginHorizontal: 0 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text accessibilityRole="header" style={{ fontSize: 15, fontWeight: '700', color: THEME.ink }}>{t('progress_symptoms_title')}</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: THEME.amber }}>{t('progress_symptoms_this_week', { n: weekSymptoms })}</Text>
            </View>
            <Text style={{ fontSize: 12, color: THEME.textMuted, marginTop: 2, marginBottom: 16 }}>{t('progress_symptoms_sub')}</Text>
            <WeeklyBars data={series.map(d => ({ label: d.label, value: d.symptoms }))} color={THEME.amber} />
          </View>

          <View style={[s.cardOutlined, { marginHorizontal: 0 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text accessibilityRole="header" style={{ fontSize: 15, fontWeight: '700', color: THEME.ink }}>{t('progress_sleep_title')}</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#456a92' }}>{avgSleep === '—' ? '—' : t('progress_sleep_avg', { n: avgSleep })}</Text>
            </View>
            <Text style={{ fontSize: 12, color: THEME.textMuted, marginTop: 2, marginBottom: 16 }}>{t('progress_sleep_sub')}</Text>
            <WeeklyBars data={series.map(d => ({ label: d.label, value: d.sleep, display: d.sleep ? `${d.sleep}h` : '' }))} color="#7da0c0" max={10} />
          </View>

          <View style={[s.cardOutlined, { marginHorizontal: 0 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text accessibilityRole="header" style={{ fontSize: 15, fontWeight: '700', color: THEME.ink }}>{t('progress_water_title')}</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#2f7bbf' }}>{avgWater === '—' ? '—' : t('progress_water_avg', { n: avgWater })}</Text>
            </View>
            <Text style={{ fontSize: 12, color: THEME.textMuted, marginTop: 2, marginBottom: 16 }}>{t('progress_water_sub')}</Text>
            <WeeklyBars data={series.map(d => ({ label: d.label, value: d.water, display: d.water ? `${d.water}` : '' }))} color="#5aa0e0" max={WATER_GOAL} />
          </View>

          <View style={{ height: 30 }} />
        </ScrollView>
      </SafeAreaViewSC>
    </SlideOverModal>
  );
}

// Group log entries into day buckets (most-recent first), each with a localized label
// (Today / Yesterday / weekday+date). Uses local calendar days.
function groupLogByDay(entries, t, lang) {
  const groups = new Map();
  (entries || []).forEach(e => {
    if (!e.timestamp) return;
    const d = new Date(e.timestamp); d.setHours(0, 0, 0, 0);
    const k = d.getTime();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const ykey = today.getTime() - 86400000;
  return Array.from(groups.keys()).sort((a, b) => b - a).map(k => {
    const items = groups.get(k).slice().sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    let label;
    if (k === today.getTime()) label = t('home_today');
    else if (k === ykey) label = t('home_yesterday');
    else { try { label = new Date(k).toLocaleDateString(lang, { weekday: 'short', day: 'numeric', month: 'short' }); } catch (e2) { label = new Date(k).toLocaleDateString(); } }
    return { key: k, label, items };
  });
}

const s_dayHeader = { fontSize: 12, fontWeight: '700', color: THEME.textMuted, marginHorizontal: 20, marginTop: 10, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.3 };

// One row in the log timeline — shared by the Home preview and the full History screen.
function LogEntryRow({ entry, reintroProgress, lang, t, onPress }) {
  // Combined, spoken-friendly label so screen readers announce the whole row + its action.
  const catLabel = (c) => c === 'high' ? t('meal_high') : c === 'mod' ? t('meal_moderate') : t('meal_low');
  const editHint = t('edit_title');
  if (entry.type === 'symptom') return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={`${entry.symptom}, ${t('timeline_intensity', { n: entry.intensity })}, ${entry.time}`} accessibilityHint={editHint} style={s.timelineRow}>
      <View style={[s.timelineDot, { backgroundColor: '#fde0e0' }]}><Text style={{ fontSize: 16 }}>⚠️</Text></View>
      <View style={{ flex: 1 }}><Text style={s.timelineTitle}>{entry.symptom}</Text><Text style={s.timelineMeta}>{t('timeline_intensity', { n: entry.intensity })}</Text></View>
      <Text style={s.timelineTime}>{entry.time}</Text>
      <View importantForAccessibility="no" style={{ marginLeft: 6 }}><ChevronIcon size={16} color="#647264" /></View>
    </TouchableOpacity>
  );
  if (entry.type === 'sleep') return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={`${t('sleep_title')}, ${entry.hours}h, ${entry.time}`} accessibilityHint={editHint} style={s.timelineRow}>
      <View style={[s.timelineDot, { backgroundColor: '#e0e8f0' }]}><Text style={{ fontSize: 16 }}>😴</Text></View>
      <View style={{ flex: 1 }}><Text style={s.timelineTitle}>{t('sleep_title')}</Text><Text style={s.timelineMeta}>{entry.hours}h</Text></View>
      <Text style={s.timelineTime}>{entry.time}</Text>
      <View importantForAccessibility="no" style={{ marginLeft: 6 }}><ChevronIcon size={16} color="#647264" /></View>
    </TouchableOpacity>
  );
  if (entry.type === 'stress') return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={`${t('timeline_stress', { n: entry.level })}, ${entry.time}`} accessibilityHint={editHint} style={s.timelineRow}>
      <View style={[s.timelineDot, { backgroundColor: '#fff4d0' }]}><Text style={{ fontSize: 16 }}>🧘</Text></View>
      <View style={{ flex: 1 }}><Text style={s.timelineTitle}>{t('timeline_stress', { n: entry.level })}</Text></View>
      <Text style={s.timelineTime}>{entry.time}</Text>
      <View importantForAccessibility="no" style={{ marginLeft: 6 }}><ChevronIcon size={16} color="#647264" /></View>
    </TouchableOpacity>
  );
  if (entry.type === 'water') {
    const glassesLabel = entry.glasses === 1 ? t('water_glasses_one', { n: 1 }) : t('water_glasses', { n: entry.glasses });
    return (
      <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={`${t('water_title')}, ${glassesLabel}, ${entry.time}`} accessibilityHint={editHint} style={s.timelineRow}>
        <View style={[s.timelineDot, { backgroundColor: '#dceaf7' }]}><Text style={{ fontSize: 16 }}>💧</Text></View>
        <View style={{ flex: 1 }}><Text style={s.timelineTitle}>{t('water_title')}</Text><Text style={s.timelineMeta}>{glassesLabel}</Text></View>
        <Text style={s.timelineTime}>{entry.time}</Text>
        <View importantForAccessibility="no" style={{ marginLeft: 6 }}><ChevronIcon size={16} color="#647264" /></View>
      </TouchableOpacity>
    );
  }
  if (entry.productName) {
    const col = CAT_COLORS[entry.productRisk || 'low'];
    return (
      <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={`${entry.productName}${entry.productRisk ? ', ' + catLabel(entry.productRisk) : ''}, ${entry.time}`} accessibilityHint={editHint} style={s.timelineRow}>
        <View style={[s.timelineDot, { backgroundColor: col.bg }]}><Text style={{ fontSize: 16 }}>📦</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}><Text style={s.timelineTitle} numberOfLines={1}>{entry.productName}</Text><Text style={s.timelineMeta}>{entry.time}</Text></View>
        {entry.productRisk ? <RiskPill cat={entry.productRisk} t={t} /> : <Text style={s.timelineTime}>{entry.time}</Text>}
        <View importantForAccessibility="no" style={{ marginLeft: 6 }}><ChevronIcon size={16} color="#647264" /></View>
      </TouchableOpacity>
    );
  }
  const meal = categorizeMeal(entry.items || [], reintroProgress);
  const col = CAT_COLORS[meal.overall];
  const names = (entry.items || []).map(i => { const f = FOODS.find(x => x.id === i.foodId); return f ? foodName(f, lang) : null; }).filter(Boolean).join(', ');
  const dishNames = (entry.mealDishes || []).map(id => { const f = FOODS.find(x => x.id === id); return f ? foodName(f, lang) : null; }).filter(Boolean).join(', ');
  // Ingredients the user added on top of the dish(es) — everything in the meal that isn't
  // claimed by a logged dish's own recipe. Uses the same grouping helper as the detail view
  // (so a food shared by two dishes is counted per dish, not swallowed for the whole meal).
  const extraItems = dishNames ? groupMealItemsByDish(entry.items || [], entry.mealDishes).extras : [];
  const extraNames = extraItems.map(it => { const f = FOODS.find(x => x.id === it.foodId); return f ? foodName(f, lang) : null; }).filter(Boolean).join(', ');
  const extraLabel = extraItems.length > 0 ? ' ' + (extraItems.length === 1 ? t('timeline_extra_one', { n: 1 }) : t('timeline_extra', { n: extraItems.length })) : '';
  const title = dishNames ? dishNames + extraLabel : (names || t('timeline_meal_fallback'));
  const firstFood = FOODS.find(f => f.id === (entry.mealDishes?.[0] || entry.items?.[0]?.foodId));
  const mtLabel = entry.mealType ? t('meal_type_' + entry.mealType) : '';
  const why = mealWhyText(meal, lang);
  const a11yLabel = `${title}${extraNames ? ', ' + extraNames : ''}, ${catLabel(meal.overall)}${mtLabel ? ', ' + mtLabel : ''}, ${entry.time}`;
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={a11yLabel} accessibilityHint={editHint} style={s.timelineRow}>
      <View style={[s.timelineDot, { backgroundColor: col.bg }]}><Text style={{ fontSize: 16 }}>{firstFood?.emoji || '🍽️'}</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.timelineTitle} numberOfLines={1}>{title}</Text>
        {extraNames ? <Text style={{ fontSize: 11, color: THEME.textMuted, marginTop: 1 }} numberOfLines={1}>{extraNames}</Text> : null}
        <Text style={s.timelineMeta} numberOfLines={1}>{mtLabel ? mtLabel + ' · ' : ''}{entry.time}</Text>
        {why ? <Text style={{ fontSize: 11, color: col.text, marginTop: 3, lineHeight: 15 }} numberOfLines={2}>{t('meal_why_label')}: {why}</Text> : null}
      </View>
      <RiskPill cat={meal.overall} t={t} />
      <View importantForAccessibility="no" style={{ marginLeft: 6 }}><ChevronIcon size={16} color="#647264" /></View>
    </TouchableOpacity>
  );
}

// Full-screen list of every log entry, grouped by day.
function HistoryModal({ visible, onClose, log, reintroProgress, onEditEntry, lang, t }) {
  const groups = groupLogByDay(log, t, lang);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaViewSC style={{ flex: 1, backgroundColor: THEME.bg }}>
        <AppBar title={t('history_title')} onBack={onClose} backIcon="close" t={t} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
          {groups.length === 0
            ? <Text style={{ fontSize: 14, color: THEME.textMuted, textAlign: 'center', marginTop: 40 }}>{t('patterns_empty_none')}</Text>
            : groups.map(group => (
              <View key={group.key}>
                <Text style={s_dayHeader}>{group.label}</Text>
                {group.items.map(entry => <LogEntryRow key={entry.id} entry={entry} reintroProgress={reintroProgress} lang={lang} t={t} onPress={() => onEditEntry(entry)} />)}
              </View>
            ))}
        </ScrollView>
      </SafeAreaViewSC>
    </Modal>
  );
}

const PATTERN_SEV = {
  watch: { bg: '#fff4f0', border: '#f0d0c0', tag: '#a04030' },
  maybe: { bg: '#fbeed3', border: '#f0dca8', tag: '#a05a10' },
  info: { bg: '#f0f4f8', border: '#d8e0ea', tag: '#4a6a8a' },
  good: { bg: '#f0f7f0', border: '#cfe0cf', tag: '#2d6a2d' },
};

function PatternsModal({ visible, onClose, log, lang, t }) {
  const patterns = detectPatterns(log, lang);
  const sevLabel = { watch: t('sev_watch'), maybe: t('sev_maybe'), info: t('sev_info'), good: t('sev_good') };
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaViewSC style={{ flex: 1, backgroundColor: THEME.bg }}>
        <AppBar title={t('home_patterns')} onBack={onClose} backIcon="close" t={t} />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <Text style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 12, lineHeight: 17 }}>{t('patterns_sub')}</Text>
          {patterns.length === 0 ? (
            <Text style={{ fontSize: 14, color: THEME.textMuted, textAlign: 'center', marginTop: 40 }}>
              {log.length < 6 ? t('patterns_empty_early') : t('patterns_empty_none')}
            </Text>
          ) : patterns.map(p => {
            const sev = PATTERN_SEV[p.severity];
            return (
              <View key={p.id} style={{ marginBottom: 8, backgroundColor: sev.bg, borderWidth: 1, borderColor: sev.border, borderRadius: 14, padding: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Text style={{ fontSize: 18 }}>{p.icon}</Text>
                  <View style={{ backgroundColor: sev.tag, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                    <Text style={{ fontSize: 9, color: 'white', fontWeight: '700', letterSpacing: 0.3 }}>{sevLabel[p.severity]}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 4 }}>{p.title}</Text>
                <Text style={{ fontSize: 12, color: '#6b7a6b', lineHeight: 18 }}>{p.detail}</Text>
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaViewSC>
    </Modal>
  );
}

function HomeScreen({ profile, log, dayCount, reintroProgress, periodActive, currentPhase, phaseStartDate, onStartElimination, onStartReintroduction, onOpenSettings, onLogPeriod, onEditEntry, onQuickLog, onOpenHistory, onOpenRecipes, onOpenRecipe, onOpenColony, onOpenProgress, onOpenPatterns, onGoToPlan, onDiagnosed, signedIn, onOpenAccount, accountBannerDismissed, onDismissAccountBanner, lang, t }) {
  const greeting = profile.name ? t('home_hi_name', { name: profile.name }) : t('home_hi');
  const showPeriod = profile.menstruates === 'yes';
  const [showDoctorInfo, setShowDoctorInfo] = useState(false);
  const [showHowMore, setShowHowMore] = useState(false);
  const symptoms = log.filter(e => e.type === 'symptom');
  const meals = log.filter(e => e.type === 'meal');
  const symptomFreeCount = log.length === 0 ? 0 : Math.max(0, dayCount - new Set(symptoms.map(s => (s.timestamp || '').slice(0, 10))).size);

  const hasData = log.length > 0;
  const stats = hasData ? homeStats(log, reintroProgress, symptomFreeCount, t) : null;
  const phaseLabel = currentPhase === 'elimination' ? t('settings_phase_elimination') : currentPhase === 'reintroduction' ? t('settings_phase_reintroduction') : null;

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
      {/* Gradient hero — greeting + reactive Flora, no card around the mascot */}
      <LinearGradient colors={['#d7ecd0', '#e7f3e1', '#eef6e9']} locations={[0, 0.7, 1]} style={{ paddingBottom: 46 }}>
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={s.h1}>{greeting}</Text>
            <Text style={s.sub}>{hasData ? t('home_journey_day', { n: dayCount }) : t('home_lets_start')}</Text>
          </View>
          {symptomFreeCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 20, paddingHorizontal: 11, paddingVertical: 6, marginRight: 8 }}>
              <Text style={{ fontSize: 14 }}>🔥</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: THEME.primaryDark }}>{symptomFreeCount}</Text>
            </View>
          )}
          <TouchableOpacity onPress={onOpenSettings} accessibilityRole="button" accessibilityLabel={t('settings_title')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={s.avatar}>
            <Text style={{ color: 'white', fontWeight: '600' }}>{(profile.name || 'U').charAt(0).toUpperCase()}</Text>
          </TouchableOpacity>
        </View>
        <View style={{ alignItems: 'center', marginTop: 2 }}>
          {hasData
            ? <BlinkingFlora size={150} mood={stats.mood} form={stats.form} />
            : <AnimatedFloraCare width={200} />}
        </View>
      </LinearGradient>

      {/* Sheet — overlaps the hero with a rounded top edge */}
      <View style={s.sheet}>
        {!hasData && (
          <>
            <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: THEME.ink, letterSpacing: -0.3, textAlign: 'center' }}>{t('home_empty_title')}</Text>
              <Text style={{ fontSize: 14, color: THEME.textSoft, textAlign: 'center', marginTop: 8, lineHeight: 21 }}>
                {t('home_empty_body')}
              </Text>
            </View>

            {currentPhase === 'not_started' && (
              <TouchableOpacity onPress={onStartElimination} style={[s.btnPrimary, { marginHorizontal: 20, marginTop: 20 }]}>
                <Text style={s.btnPrimaryText}>{t('home_start_elim')}</Text>
              </TouchableOpacity>
            )}

            {profile.ibsDiagnosed !== 'yes' && (
              <View style={{ marginHorizontal: 20, marginTop: 22 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', letterSpacing: 1, color: THEME.textMuted, marginBottom: 12 }}>{t('home_before_start')}</Text>
                <View style={{ backgroundColor: '#fffaf0', borderRadius: 18, padding: 14 }}>
                  <TouchableOpacity onPress={() => setShowDoctorInfo(v => !v)} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#fbeed0', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 20 }}>🩺</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: THEME.ink }}>{t('home_gp_title')}</Text>
                      <Text style={{ fontSize: 12, color: THEME.textSoft, marginTop: 2, lineHeight: 17 }}>{t('home_gp_sub')}</Text>
                    </View>
                    <Text style={{ fontSize: 20, color: THEME.textMuted, transform: [{ rotate: showDoctorInfo ? '90deg' : '0deg' }] }}>›</Text>
                  </TouchableOpacity>
                  {showDoctorInfo && (
                    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(20,40,20,0.07)' }}>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <Text style={{ fontSize: 16 }}>🔍</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: THEME.ink, lineHeight: 18 }}>{t('home_gp_confirm')}</Text>
                          <Text style={{ fontSize: 12, color: THEME.textSoft, marginTop: 2, lineHeight: 17 }}>{t('home_gp_confirm_body')}</Text>
                        </View>
                      </View>
                    </View>
                  )}

                  <TouchableOpacity onPress={onDiagnosed} activeOpacity={0.8} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(20,40,20,0.07)' }}>
                    <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#c0d0c0', backgroundColor: 'white' }} />
                    <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: THEME.ink, lineHeight: 17 }}>{t('home_diagnosed')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={{ marginHorizontal: 20, marginTop: 22, marginBottom: 12 }}>
              <Text accessibilityRole="header" style={{ fontSize: 13, fontWeight: '700', letterSpacing: 1, color: THEME.textMuted, marginBottom: 6 }}>{t('home_how_it_works')}</Text>
              {showHowMore && <Text style={{ fontSize: 13, color: THEME.textSoft, lineHeight: 19, marginBottom: 8 }}>{t('home_how_intro')}</Text>}
              {[
                { n: '1', title: t('home_step1_title'), sub: t('home_step1_sub') },
                { n: '2', title: t('home_step2_title'), sub: t('home_step2_sub') },
                { n: '3', title: t('home_step3_title'), sub: t('home_step3_sub') },
                { n: '4', title: t('home_step4_title'), sub: t('home_step4_sub') },
              ].map((stp, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: showHowMore ? 'flex-start' : 'center', gap: 12, paddingVertical: 9, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: '#e7ece6' }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#4e7d4e', alignItems: 'center', justifyContent: 'center', marginTop: showHowMore ? 1 : 0 }}>
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>{stp.n}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: THEME.ink }}>{stp.title}</Text>
                    {showHowMore && <Text style={{ fontSize: 12, color: THEME.textMuted, marginTop: 3, lineHeight: 17 }}>{stp.sub}</Text>}
                  </View>
                </View>
              ))}
              <TouchableOpacity onPress={() => setShowHowMore(v => !v)} accessibilityRole="button" accessibilityState={{ expanded: showHowMore }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ paddingVertical: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: THEME.primary }}>{showHowMore ? t('home_how_less') : t('home_how_more')}</Text>
              </TouchableOpacity>
              {showHowMore && <Text style={{ fontSize: 11, color: THEME.textMuted, lineHeight: 16, fontStyle: 'italic' }}>{t('home_how_note')}</Text>}
            </View>
          </>
        )}

        {hasData && (
          <>
            <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
              <Text style={s.moodTitle}>{stats.title}</Text>
              <Text style={s.moodSub}>{stats.sub}</Text>
              <View style={s.phasePill}><Text style={s.phasePillText}>{t('pill_day', { n: dayCount })}{phaseLabel ? ` · ${phaseLabel}` : ''}</Text></View>
            </View>

            <View style={[s.sectionHeader, { marginTop: 26 }]}>
              <Text accessibilityRole="header" style={s.sectionTitle}>{t('home_today')}</Text>
              <TouchableOpacity onPress={onOpenProgress}><Text style={s.sectionLink}>{t('home_see_progress')}</Text></TouchableOpacity>
            </View>
            <TouchableOpacity activeOpacity={0.85} onPress={onOpenProgress} style={{ flexDirection: 'row', gap: 11, marginHorizontal: 20, marginBottom: 12 }}>
              <Surface elevation={1} tinted={false} style={{ flex: 1, backgroundColor: THEME.card, borderRadius: THEME.rCard, paddingVertical: 16, alignItems: 'center' }}>
                <ScoreRing value={stats.adherencePct || 0} size={56} stroke={6} color={stats.ringColor} centerValue={stats.adherencePct == null ? '—' : `${stats.adherencePct}%`} />
                <Text style={{ fontSize: 12, color: THEME.textSoft, marginTop: 8, fontWeight: '600' }}>{t('home_low_fodmap')}</Text>
              </Surface>
              <MetricTile value={stats.symptomsCount} label={t('home_symptoms')} />
              <MetricTile value={stats.sleep} unit={stats.sleepUnit} label={t('home_sleep')} />
            </TouchableOpacity>

            {/* Hydration — today's glasses vs a daily goal; tap to log more water */}
            <TouchableOpacity activeOpacity={0.85} onPress={() => onQuickLog && onQuickLog('water')} accessibilityRole="button" accessibilityLabel={`${t('water_title')}, ${t('water_progress', { n: stats.waterGlasses, goal: WATER_GOAL, liters: WATER_GOAL_LITERS })}`}>
            <Surface elevation={1} tinted={false} style={[s.cardFilled, { backgroundColor: THEME.card, marginTop: 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#dceaf7', alignItems: 'center', justifyContent: 'center' }}>
                  <Text importantForAccessibility="no" style={{ fontSize: 18 }}>💧</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: THEME.ink }}>{t('water_title')}</Text>
                  <Text style={{ fontSize: 12, color: THEME.textSoft, marginTop: 1 }}>{t('water_progress', { n: stats.waterGlasses, goal: WATER_GOAL, liters: WATER_GOAL_LITERS })}</Text>
                </View>
                <View importantForAccessibility="no" style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#dcebdc', alignItems: 'center', justifyContent: 'center' }}>
                  <IconPlus size={18} color={THEME.primaryDark} />
                </View>
              </View>
              <View importantForAccessibility="no" style={{ flexDirection: 'row', gap: 5, marginTop: 12 }}>
                {Array.from({ length: WATER_GOAL }).map((_, i) => (
                  <View key={i} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: i < stats.waterGlasses ? '#5aa0e0' : '#e3e9ef' }} />
                ))}
              </View>
              {stats.waterGlasses >= WATER_GOAL && <Text style={{ fontSize: 11.5, color: '#2f7bbf', fontWeight: '600', marginTop: 8 }}>{t('water_goal_reached')}</Text>}
            </Surface>
            </TouchableOpacity>
          </>
        )}

      {hasData && <ColonyCard log={log} reintroProgress={reintroProgress} onOpenBreakdown={onOpenColony} t={t} />}

      {log.length > 0 && <PhaseProgressWidget currentPhase={currentPhase} phaseStartDate={phaseStartDate} onStartElimination={onStartElimination} onStartReintroduction={onStartReintroduction} onGoToPlan={onGoToPlan} t={t} />}

      {currentPhase === 'elimination' && <TodaysMealsCard dayCount={dayCount} onOpenRecipes={onOpenRecipes} onOpenRecipe={onOpenRecipe} lang={lang} />}

      {log.length > 0 && <InsightsCard log={log} lang={lang} onOpenPatterns={onOpenPatterns} />}

      {showPeriod && (
        <Surface elevation={1} primaryColor={THEME.primary} style={[s.cardFilled, { backgroundColor: periodActive ? '#fdf2f4' : THEME.card }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#fde0e6', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18 }}>🩸</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: THEME.ink }}>{periodActive ? t('period_turn_off') : t('period_turn_on')}</Text>
              <Text style={{ fontSize: 12, color: periodActive ? '#a23a52' : THEME.textSoft, fontWeight: periodActive ? '600' : '400', marginTop: 1 }}>{periodActive ? t('period_active') : t('period_tracking')}</Text>
            </View>
            <Switch
              value={periodActive}
              onValueChange={onLogPeriod}
              trackColor={{ false: '#d8e0d8', true: '#c85050' }}
              thumbColor="#ffffff"
              ios_backgroundColor="#d8e0d8"
            />
          </View>
          <Text style={{ fontSize: 12, color: THEME.textSoft, lineHeight: 18, marginTop: 12 }}>
            {t('period_body')}
          </Text>
        </Surface>
      )}

      {log.length > 0 && (() => {
        const HOME_LOG_LIMIT = 12;
        const homeEntries = log.slice().sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)).slice(0, HOME_LOG_LIMIT);
        const homeGroups = groupLogByDay(homeEntries, t, lang);
        const hasMore = log.length > HOME_LOG_LIMIT;
        // Nudge: prompt the two once-a-day lifestyle logs when the day has entries but they're missing.
        const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
        const loggedToday = (type) => log.some(e => e.type === type && e.timestamp && new Date(e.timestamp) >= startOfToday);
        const needSleep = !loggedToday('sleep');
        const needStress = !loggedToday('stress');
        const needWater = !loggedToday('water');
        const NudgeChip = ({ emoji, label, onPress }) => (
          <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'white', borderWidth: 1, borderColor: '#c4cec4', borderRadius: 20, paddingLeft: 10, paddingRight: 14, paddingVertical: 7 }}>
            <Text importantForAccessibility="no" style={{ fontSize: 15 }}>{emoji}</Text>
            <Text importantForAccessibility="no" style={{ fontSize: 13, fontWeight: '600', color: THEME.primaryDark }}>{label}</Text>
          </TouchableOpacity>
        );
        return (
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginBottom: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: '600' }}>{t('home_journal')}</Text>
              <Text style={{ fontSize: 12, color: '#647264' }}>{t('timeline_entries', { n: log.length })}</Text>
            </View>
            {(needSleep || needStress || needWater) && (
              <View style={{ marginHorizontal: 20, marginBottom: 12, backgroundColor: '#dcebdc', borderRadius: 14, padding: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                  <BulbIcon size={24} color={THEME.primaryDark} />
                  <Text style={{ flex: 1, fontSize: 12.5, color: '#3d4d3d', lineHeight: 17 }}>{t('nudge_lifestyle')}</Text>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {needSleep && <NudgeChip emoji="😴" label={t('log_sleep')} onPress={() => onQuickLog && onQuickLog('sleep')} />}
                  {needStress && <NudgeChip emoji="🧘" label={t('log_stress')} onPress={() => onQuickLog && onQuickLog('stress')} />}
                  {needWater && <NudgeChip emoji="💧" label={t('log_water')} onPress={() => onQuickLog && onQuickLog('water')} />}
                </View>
              </View>
            )}
            {/* Guest-first nudge, styled like the Foods "Recipes" tile (green card) so it
                reads as a friendly CTA. Only while signed out, not dismissed, and (by
                being here) entries already exist. Tap → account; ✕ → dismiss. */}
            {!signedIn && !accountBannerDismissed && (
              <TouchableOpacity onPress={onOpenAccount} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={`${t('account_nudge_title')}, ${t('account_nudge_cta')}`} style={{ marginHorizontal: 20, marginBottom: 12, padding: 14, borderRadius: 16, backgroundColor: THEME.primary, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                  <TablerIcon size={22} color="#ffffff" paths={['M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0', 'M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2']} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>{t('account_nudge_title')}</Text>
                  <Text style={{ fontSize: 12, color: '#eaf3ea', marginTop: 2, lineHeight: 16, fontWeight: '600' }}>{t('account_nudge_cta')}</Text>
                </View>
                <TouchableOpacity onPress={onDismissAccountBanner} accessibilityRole="button" accessibilityLabel={t('close')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <XIcon size={24} color="#eaf3ea" />
                </TouchableOpacity>
              </TouchableOpacity>
            )}
            {homeGroups.map(group => (
              <View key={group.key}>
                <Text style={s_dayHeader}>{group.label}</Text>
                {group.items.map(entry => <LogEntryRow key={entry.id} entry={entry} reintroProgress={reintroProgress} lang={lang} t={t} onPress={() => onEditEntry(entry)} />)}
              </View>
            ))}
            {hasMore && (
              <TouchableOpacity onPress={onOpenHistory} accessibilityRole="button" accessibilityLabel={t('see_history')} style={{ marginTop: 6, paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: THEME.primary, fontWeight: '700' }}>{t('see_history')}</Text>
              </TouchableOpacity>
            )}
          </>
        );
      })()}
        <View style={{ height: 100 }} />
      </View>
    </ScrollView>
  );
}

function PhaseProgressWidget({ currentPhase, phaseStartDate, onStartElimination, onStartReintroduction, onGoToPlan, t }) {
  const PlanHeader = () => (
    <TouchableOpacity onPress={onGoToPlan} accessibilityRole="button" accessibilityLabel={t('phase_plan_link')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ alignSelf: 'flex-end', marginHorizontal: 20, marginTop: 8, marginBottom: 6 }}>
      <Text style={{ fontSize: 13, color: THEME.primary, fontWeight: '700' }}>{t('phase_plan_link')}</Text>
    </TouchableOpacity>
  );

  if (currentPhase === 'not_started') {
    return (
      <View>
        <PlanHeader />
        <TouchableOpacity activeOpacity={0.85} onPress={onGoToPlan}>
          <Surface elevation={1} tinted={false} style={[s.cardFilled, { backgroundColor: THEME.card }]}>
            <Text style={{ fontSize: 20 }}>🌱</Text>
            <Text style={[s.cardTitle, { marginTop: 8 }]}>{t('phase_ready_title')}</Text>
            <Text style={s.cardText}>{t('phase_ready_body')}</Text>
          </Surface>
        </TouchableOpacity>
      </View>
    );
  }
  const start = new Date(phaseStartDate);
  const now = new Date();
  const daysSince = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  const weekNum = Math.floor(daysSince / 7) + 1;

  if (currentPhase === 'elimination') {
    const totalDays = 42;
    const progress = Math.min(100, (daysSince / totalDays) * 100);
    const readyForReintro = weekNum >= 4;
    const daysSoFar = Math.max(1, daysSince);
    const headline = daysSoFar === 1 ? t('phase_elim_headline_1') : t('phase_elim_headline_n', { n: daysSoFar });
    return (
      <View>
        <PlanHeader />
        <TouchableOpacity activeOpacity={0.85} onPress={onGoToPlan}>
          <Surface elevation={1} tinted={false} style={[s.cardFilled, { backgroundColor: THEME.card }]}>
            <View style={s.badgeGreen}><Text style={s.badgeGreenText}>{t('phase_elim_badge', { n: weekNum })}</Text></View>
            <Text style={[s.cardTitle, { marginTop: 8 }]}>{headline}</Text>
            <Text style={s.cardText}>{readyForReintro ? t('phase_elim_body_ready') : t('phase_elim_body_early')}</Text>
            <View style={{ height: 8, backgroundColor: '#e0e8e0', borderRadius: 4, marginTop: 12, overflow: 'hidden' }}>
              <View style={{ height: 8, backgroundColor: '#4e7d4e', width: `${progress}%`, borderRadius: 4 }} />
            </View>
          </Surface>
        </TouchableOpacity>
      </View>
    );
  }
  if (currentPhase === 'reintroduction') {
    const totalWeeks = 8;
    const progress = Math.min(100, (daysSince / (totalWeeks * 7)) * 100);
    return (
      <View>
        <PlanHeader />
        <TouchableOpacity activeOpacity={0.85} onPress={onGoToPlan}>
          <Surface elevation={1} tinted={false} style={[s.cardFilled, { backgroundColor: THEME.card }]}>
            <View style={s.badge}><Text style={s.badgeText}>{t('phase_reintro_badge')}</Text></View>
            <Text style={[s.cardTitle, { marginTop: 8 }]}>{t('phase_reintro_headline', { n: weekNum, total: totalWeeks })}</Text>
            <Text style={s.cardText}>{t('phase_reintro_body')}</Text>
            <View style={{ height: 8, backgroundColor: '#f0f4f0', borderRadius: 4, marginTop: 12, overflow: 'hidden' }}>
              <View style={{ height: 8, backgroundColor: '#d4a040', width: `${progress}%`, borderRadius: 4 }} />
            </View>
          </Surface>
        </TouchableOpacity>
      </View>
    );
  }
  return null;
}

function FoodExplorerScreen({ reintroProgress, onOpenRecipes, profile, t, lang }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [catFilter, setCatFilter] = useState([]);   // selected food categories (f.group), empty = all
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  // Category multi-select, ordered by how many foods each holds. 'dish' lives here now.
  const CATEGORY_IDS = ['dish', 'fruit', 'veg', 'dairy', 'protein', 'grain', 'drink', 'nut', 'sauce', 'sweet', 'legume'];
  const catLabel = (id) => id === 'dish' ? t('filter_dishes') : t('grp_' + id);
  const toggleCat = (id) => setCatFilter(catFilter.includes(id) ? catFilter.filter(c => c !== id) : catFilter.concat([id]));
  const q = search.trim().toLowerCase();
  const hasFilters = !!(q || filter !== 'all' || catFilter.length > 0);
  const clearFilters = () => { setSearch(''); setFilter('all'); setCatFilter([]); };
  // Filter + sort in one memoized pass. Precomputing each food's localized name and search
  // rank once (instead of recomputing them inside the comparator, thousands of times) keeps
  // the Foods tab snappy — this previously ran over the whole ~260-item DB on every render.
  const filtered = useMemo(() => {
    const rows = [];
    for (const f of FOODS) {
      if (f.dishOnly) continue;   // combined dish-only ingredients aren't browsable foods
      const loc = foodName(f, lang).toLowerCase();
      const en = f.name.toLowerCase();
      const alias = (f.alias || '').toLowerCase();
      if (q && en.indexOf(q) < 0 && loc.indexOf(q) < 0 && alias.indexOf(q) < 0) continue;
      if (filter !== 'all' && f.cat !== filter) continue;
      if (catFilter.length > 0 && !catFilter.includes(f.group)) continue;
      // Best (lowest) match rank across the food's names: 0 exact, 1 starts-with, 2 contains, 3 none.
      let rank = 3;
      if (q) {
        for (const n of [loc, en, alias]) {
          if (!n) continue;
          if (n === q) { rank = 0; break; }
          if (n.startsWith(q)) rank = Math.min(rank, 1);
          else if (n.indexOf(q) >= 0) rank = Math.min(rank, 2);
        }
      }
      rows.push({ f, name: loc, rank });
    }
    rows.sort((a, b) => {
      if (q && a.rank !== b.rank) return a.rank - b.rank;   // relevance first when searching
      return a.name.localeCompare(b.name, lang);            // alphabetical (localized)
    });
    return rows.map(r => r.f);
  }, [q, filter, catFilter, lang]);
  const filters = [{ id: 'all', label: t('filter_all') }, { id: 'high', label: t('filter_high') }, { id: 'mod', label: t('filter_mod') }, { id: 'low', label: t('filter_low') }];
  if (selected) return <FoodDetailView food={selected} status={reintroProgress[selected.groups[0]]} profile={profile} t={t} lang={lang} onBack={() => setSelected(null)} />;
  const renderItem = ({ item: f }) => {
    const displayCat = f.fermented && f.cat === 'high' ? 'mod' : f.cat;
    const col = CAT_COLORS[displayCat];
    const status = f.groups[0] ? reintroProgress[f.groups[0]] : null;
    const warnings = crossIntoleranceWarnings(f, profile);
    const riskLabel = displayCat === 'mod' ? t('risk_moderate') : displayCat === 'high' ? t('risk_high') : t('risk_low');
    const statusLabel = status === 'tolerated' ? t('list_tolerated') : status === 'trigger' ? t('list_trigger') : '';
    const a11yLabel = `${foodName(f, lang)}, ${riskLabel}${statusLabel ? ', ' + statusLabel : ''}`;
    return (
      <TouchableOpacity onPress={() => setSelected(f)} accessibilityRole="button" accessibilityLabel={a11yLabel} style={s.timelineRow}>
        <View style={[s.timelineDot, { backgroundColor: col.bg }]}><Text style={{ fontSize: 18 }}>{f.emoji}</Text></View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 14, fontWeight: '600' }}>{foodName(f, lang)}</Text>
            {f.fermented && <View style={{ backgroundColor: '#fff0c0', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}><Text style={{ fontSize: 9, color: '#8a5a10', fontWeight: '700' }}>🧫 {t('list_fermented')}</Text></View>}
            {status === 'tolerated' && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><CheckIcon color="#4e7d4e" size={16} /><Text style={{ fontSize: 11, color: '#4e7d4e' }}>{t('list_tolerated')}</Text></View>}
            {status === 'trigger' && <Text style={{ fontSize: 11, color: '#a03030' }}>✕ {t('list_trigger')}</Text>}
            {warnings.map((w, i) => (
              <View key={i} style={{ backgroundColor: w.color, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                <Text style={{ fontSize: 9, color: 'white', fontWeight: '700' }}>🌡 {t('hist_' + w.level)}</Text>
              </View>
            ))}
          </View>
          <Text style={{ fontSize: 12, color: '#647264', marginTop: 2 }}>{f.base ? t('food_base_note') : f.smallPortionOk ? t('small_portion_note') : f.fermented && f.cat === 'high' ? t('fermented_tolerance_note') : triggerBand(f.popTrigger, t).short}</Text>
        </View>
        <RiskPill cat={displayCat} t={t} />
        <View importantForAccessibility="no" style={{ marginLeft: 6 }}><ChevronIcon size={16} color="#647264" /></View>
      </TouchableOpacity>
    );
  };
  const stickyTop = (
    <View style={{ backgroundColor: THEME.bg }}>
      <View style={s.headerRow}><View><Text accessibilityRole="header" style={s.h1}>{t('foods_title')}</Text><Text style={s.sub}>{t('foods_sub')}</Text></View></View>
      <View style={{ marginHorizontal: 20, marginBottom: 12, backgroundColor: '#e6ede6', borderRadius: 28, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 52 }}>
        <View style={{ marginRight: 10 }}><SearchIcon size={20} /></View>
        <TextInput accessibilityLabel={t('foods_search')} value={search} onChangeText={setSearch} placeholder={t('foods_search')} style={{ flex: 1, paddingVertical: 12, fontSize: 16 }} />
        {search ? <TouchableOpacity onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel={t('a11y_clear')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.6} style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#16210f', alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}><XIcon size={13} color="#ffffff" /></TouchableOpacity> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, paddingHorizontal: 16 }}>
        {filters.map(f => (
          <React.Fragment key={f.id}>
            <TouchableOpacity onPress={() => setFilter(f.id)} accessibilityRole="radio" accessibilityState={{ selected: filter === f.id }} accessibilityLabel={f.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: filter === f.id ? '#dcebdc' : 'transparent', borderWidth: 1, borderColor: filter === f.id ? '#dcebdc' : '#c4cec4', marginRight: 8 }}>
              {filter === f.id && <CheckIcon color="#2d6a2d" size={24} />}
              <Text style={{ fontSize: 14, fontWeight: filter === f.id ? '600' : '500', color: filter === f.id ? '#2d6a2d' : '#2d3a2d' }}>{f.label}</Text>
            </TouchableOpacity>
            {f.id === 'all' && (
              <TouchableOpacity onPress={() => setCatModalOpen(true)} accessibilityRole="button" accessibilityState={{ expanded: catModalOpen }} accessibilityLabel={t('filter_category') + (catFilter.length ? ` (${catFilter.length})` : '')} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: catFilter.length ? '#dcebdc' : 'transparent', borderWidth: 1, borderColor: catFilter.length ? '#dcebdc' : '#c4cec4', marginRight: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: catFilter.length ? '600' : '500', color: catFilter.length ? '#2d6a2d' : '#2d3a2d' }}>{t('filter_category')}{catFilter.length ? ` (${catFilter.length})` : ''}</Text>
                <ChevronDownIcon size={16} color={catFilter.length ? '#2d6a2d' : '#647264'} />
              </TouchableOpacity>
            )}
          </React.Fragment>
        ))}
      </ScrollView>
    </View>
  );
  const listHeader = (
    <View>
      <TouchableOpacity onPress={onOpenRecipes} activeOpacity={0.85} style={{ marginHorizontal: 20, marginBottom: 14, padding: 14, borderRadius: 16, backgroundColor: THEME.primary, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
          <KitchenIcon size={22} color="#ffffff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#ffffff' }}>{t('recipes_title')}</Text>
          <Text style={{ fontSize: 12, color: '#d5e6d5', marginTop: 2, lineHeight: 16 }}>{t('recipes_flora_sub')}</Text>
        </View>
        <ChevronIcon size={16} color="#eaf3ea" />
      </TouchableOpacity>
      {filtered.length > 0 && <Text style={{ fontSize: 11, color: '#647264', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginHorizontal: 20, marginBottom: 8 }}>{t('foods_count', { n: filtered.length })}</Text>}
    </View>
  );
  const footer = (
    <View>
      <View style={{ marginHorizontal: 20, marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: '#f0f4f0' }}>
        <Text style={{ fontSize: 11, color: '#6b7a6b', lineHeight: 16 }}>{t('foods_src_note')}</Text>
      </View>
      <View style={{ height: 100 }} />
    </View>
  );
  const emptyState = (
    <View style={{ alignItems: 'center', paddingHorizontal: 40, paddingTop: 24 }}>
      <View style={{ marginBottom: 4 }}><BlinkingFlora size={120} mood="soso" /></View>
      <Text style={{ fontSize: 15, color: '#647264', textAlign: 'center', lineHeight: 21, marginBottom: 16 }}>{t('foods_no_results')}</Text>
      {hasFilters && (
        <TouchableOpacity onPress={clearFilters} accessibilityRole="button" style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: '#c4cec4' }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#2d6a2d' }}>{t('foods_clear_filters')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
  return (
    <View style={s.screen}>
      {stickyTop}
      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={f => f.id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyState}
        ListFooterComponent={footer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={11}
        removeClippedSubviews
      />
      <BottomSheet visible={catModalOpen} onClose={() => setCatModalOpen(false)}>
        <Surface elevation={3} primaryColor={THEME.primary} style={{ backgroundColor: '#fafbfa', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 28, maxHeight: Dimensions.get('window').height * 0.75 }}>
          <View style={{ alignItems: 'center', paddingVertical: 10 }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#d0d8d0' }} /></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 }}>
            <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '700' }}>{t('cat_modal_title')}</Text>
            {catFilter.length > 0 && <TouchableOpacity onPress={() => setCatFilter([])} accessibilityRole="button" accessibilityLabel={t('cat_modal_clear')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Text style={{ fontSize: 14, color: '#4e7d4e', fontWeight: '600' }}>{t('cat_modal_clear')}</Text></TouchableOpacity>}
          </View>
          <ScrollView style={{ paddingHorizontal: 12 }}>
            {CATEGORY_IDS.map(id => {
              const on = catFilter.includes(id);
              return (
                <TouchableOpacity key={id} onPress={() => toggleCat(id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={catLabel(id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 12, borderRadius: 12, backgroundColor: on ? '#e8f0e8' : 'transparent' }}>
                  <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: on ? '#4e7d4e' : '#c4cec4', backgroundColor: on ? '#4e7d4e' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{on && <CheckIcon color="#ffffff" size={14} />}</View>
                  <Text style={{ fontSize: 15, color: '#2d3a2d', fontWeight: on ? '600' : '400' }}>{catLabel(id)}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity onPress={() => setCatModalOpen(false)} accessibilityRole="button" style={[s.btnPrimary, { marginHorizontal: 20, marginTop: 12 }]}><Text style={s.btnPrimaryText}>{t('cat_modal_done', { n: filtered.length })}</Text></TouchableOpacity>
        </Surface>
      </BottomSheet>
    </View>
  );
}

function FoodDetailView({ food, status, onBack, profile, t, lang }) {
  const displayCat = food.fermented && food.cat === 'high' ? 'mod' : food.cat;
  const col = CAT_COLORS[displayCat];
  const warnings = crossIntoleranceWarnings(food, profile);
  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
      <AppBar title={foodName(food, lang)} onBack={onBack} t={t} />
      <View style={{ padding: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: col.bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 32 }}>{food.emoji}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: col.text, marginTop: 2 }}>{displayCat === 'low' ? t('meal_low') : displayCat === 'high' ? t('meal_high') : t('meal_moderate')}</Text>
            {food.fermented && <Text style={{ fontSize: 12, color: '#8a5a10', marginTop: 3 }}>🧫 {t('fermented_tolerance_note')}</Text>}
            {food.smallPortionOk && <Text style={{ fontSize: 12, color: '#8a5a10', marginTop: 3 }}>🥄 {t('small_portion_note')}</Text>}
          </View>
        </View>
        {status && (
          <View style={{ marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: status === 'tolerated' ? '#e0f0e0' : '#fde0e0' }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: status === 'tolerated' ? '#2d6a2d' : '#a03030' }}>
              {status === 'tolerated' ? t('detail_tolerate') : t('detail_trigger')}
            </Text>
          </View>
        )}
        {warnings.length > 0 && (
          <View style={{ marginTop: 16, padding: 14, borderRadius: 14, backgroundColor: '#fff4f0', borderWidth: 1.5, borderColor: '#f0d0c0' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Text style={{ fontSize: 18 }}>🌡️</Text>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#a04030' }}>{t('detail_cross_warn')}</Text>
            </View>
            {warnings.map((w, i) => (
              <Text key={i} style={{ fontSize: 13, color: '#6b4030', lineHeight: 19 }}>
                {w.level === 'high' ? t('detail_hist_high')
                  : w.level === 'mod' ? t('detail_hist_mod')
                  : t('detail_hist_lib')}
              </Text>
            ))}
            <Text style={{ fontSize: 11, color: '#8a6a5a', marginTop: 8, fontStyle: 'italic' }}>
              {t('detail_profile_note')}
            </Text>
          </View>
        )}
        <Surface elevation={1} primaryColor={THEME.primary} style={[s.cardFilled, { backgroundColor: THEME.card, marginHorizontal: 0, marginTop: 16 }]}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#647264', marginBottom: 8 }}>{t('detail_portion_head')}</Text>
          {food.cat === 'low' && !food.lowT && <Text style={{ fontSize: 14 }}>{t('detail_portion_safe')}</Text>}
          {food.cat === 'low' && food.lowT && <Text style={{ fontSize: 14 }}>{t('detail_portion_low_then', { g: food.lowT })}</Text>}
          {food.cat === 'mod' && (
            <View style={{ gap: 4 }}>
              <Text style={{ fontSize: 14 }}>{t('detail_portion_low', { g: food.lowT })}</Text>
              <Text style={{ fontSize: 14 }}>{t('detail_portion_mod', { lo: food.lowT, hi: food.modT })}</Text>
              <Text style={{ fontSize: 14 }}>{t('detail_portion_high_label', { g: food.modT })}</Text>
            </View>
          )}
          {food.cat === 'high' && <Text style={{ fontSize: 14 }}>{t('detail_portion_high_note')}</Text>}
        </Surface>
        {FERMENTATION_NOTES[food.id] && (() => {
          const baseNote = FERMENTATION_NOTES[food.id];
          const localized = fermentationText(food.id, baseNote, lang);
          const note = { tone: baseNote.tone, histamineFlag: baseNote.histamineFlag, text: localized.text, histamineText: localized.histamineText };
          const known = (profile && profile.known) || [];
          const userHasHistamine = known.indexOf('histamine') >= 0;
          const palette = note.tone === 'positive'
            ? { bg: '#f5faf5', border: '#cfe0cf', tag: '#2d6a2d', label: t('detail_ferm_good') }
            : note.tone === 'caution'
            ? { bg: '#fff4f0', border: '#f0d0c0', tag: '#a04030', label: t('detail_ferm_caution') }
            : { bg: '#fffbf0', border: '#f0e0b0', tag: '#b87a1a', label: t('detail_ferm_mixed') };
          return (
            <Surface elevation={1} primaryColor={THEME.primary} style={[s.cardFilled, { backgroundColor: palette.bg, marginHorizontal: 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Text style={{ fontSize: 18 }}>🫧</Text>
                <View style={{ backgroundColor: palette.tag, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                  <Text style={{ fontSize: 9, color: 'white', fontWeight: '700', letterSpacing: 0.3 }}>{t('detail_ferm_tag')} · {palette.label}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 13, color: '#2d3a2d', lineHeight: 19 }}>{note.text}</Text>
              {note.histamineFlag && note.histamineText && (
                <View style={{ marginTop: 10, padding: 10, borderRadius: 10, backgroundColor: userHasHistamine ? '#fde0e0' : 'rgba(0,0,0,0.03)' }}>
                  <Text style={{ fontSize: 12, color: userHasHistamine ? '#a03030' : '#8a7a6a', lineHeight: 17, fontWeight: userHasHistamine ? '600' : '400' }}>
                    🌡️ {note.histamineText}
                  </Text>
                </View>
              )}
            </Surface>
          );
        })()}
        {LOW_FODMAP_SWAPS[food.id] && (
          <Surface elevation={1} primaryColor={THEME.primary} style={[s.cardFilled, { backgroundColor: '#f5faf5', marginHorizontal: 0 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text style={{ fontSize: 18 }}>🌱</Text>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#2d6a2d' }}>{t('detail_swap_head')}</Text>
            </View>
            <Text style={{ fontSize: 12, color: '#6b7a6b', marginBottom: 12, lineHeight: 17 }}>
              {t('detail_swap_sub')}
            </Text>
            {LOW_FODMAP_SWAPS[food.id].map((swap, i) => {
              const sw = swapText(food.id, i, swap, lang);
              return (
                <View key={i} style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: '#e0ece0' }}>
                  <View style={{ marginTop: 1 }}><CheckIcon color="#4e7d4e" size={16} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#2d3a2d' }}>{sw.name}</Text>
                    <Text style={{ fontSize: 12, color: '#6b7a6b', marginTop: 2, lineHeight: 17 }}>{sw.why}</Text>
                  </View>
                </View>
              );
            })}
          </Surface>
        )}
        {!LOW_FODMAP_SWAPS[food.id] && food.cat === 'high' && (() => {
          const tips = lightenGuidance(food, lang);
          if (!tips.length) return null;
          return (
            <Surface elevation={1} primaryColor={THEME.primary} style={[s.cardFilled, { backgroundColor: '#f5faf5', marginHorizontal: 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Text style={{ fontSize: 18 }}>🌱</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#2d6a2d' }}>{t('detail_lighten_head')}</Text>
              </View>
              <Text style={{ fontSize: 12, color: '#6b7a6b', marginBottom: 12, lineHeight: 17 }}>
                {t('detail_lighten_sub')}
              </Text>
              {tips.map((tip, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: '#e0ece0' }}>
                  <View style={{ marginTop: 1 }}><CheckIcon color="#4e7d4e" size={16} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#2d3a2d' }}>{tip.name}</Text>
                    <Text style={{ fontSize: 12, color: '#6b7a6b', marginTop: 2, lineHeight: 17 }}>{tip.why}</Text>
                  </View>
                </View>
              ))}
            </Surface>
          );
        })()}
        <Surface elevation={1} primaryColor={THEME.primary} style={[s.cardFilled, { backgroundColor: THEME.card, marginHorizontal: 0 }]}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#647264', marginBottom: 8 }}>{t('detail_trigger_head')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: triggerBand(food.popTrigger, t).color }} />
            <Text style={{ fontSize: 18, fontWeight: '700', color: triggerBand(food.popTrigger, t).color }}>{triggerBand(food.popTrigger, t).label}</Text>
          </View>
          <Text style={{ fontSize: 12, color: '#647264', marginTop: 6, lineHeight: 17 }}>
            {t('detail_trigger_note')}
          </Text>
        </Surface>
        {food.groups.length > 0 && (
          <Surface elevation={1} primaryColor={THEME.primary} style={[s.cardFilled, { backgroundColor: THEME.card, marginHorizontal: 0 }]}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#647264', marginBottom: 8 }}>{t('detail_why_head')}</Text>
            {food.groups.map(g => {
              const gi = groupInfoText(g, lang);
              return (
                <View key={g} style={{ marginBottom: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600' }}>{gi.name}</Text>
                  <Text style={{ fontSize: 13, color: '#6b7a6b', marginTop: 2, lineHeight: 18 }}>{gi.desc}</Text>
                </View>
              );
            })}
          </Surface>
        )}
        <View style={{ marginHorizontal: 0, marginTop: 4, padding: 12, borderRadius: 12, backgroundColor: '#f0f4f0' }}>
          <Text style={{ fontSize: 11, color: '#6b7a6b', lineHeight: 16 }}>{t('foods_src_note')}</Text>
        </View>
      </View>
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

function PlanScreen({ profile, reintroProgress, periodActive, currentPhase, phaseStartDate, onStartElimination, onStartReintroduction, activeTest, onLogReintroDay, onCancelTest, onPickTestCategory, nextAction, isPremium, freeReintroLimit, onUpsell, t }) {
  const eliminationStatus = currentPhase === 'not_started' ? 'upcoming' : currentPhase === 'elimination' ? 'current' : 'completed';
  const reintroStatus = currentPhase === 'reintroduction' ? 'current' : currentPhase === 'not_started' || currentPhase === 'elimination' ? 'upcoming' : 'completed';
  // Elimination unlocks reintroduction once it has run long enough (week 4+), matching the Home phase widget's readiness threshold.
  const elimWeek = phaseStartDate ? Math.floor((Date.now() - new Date(phaseStartDate)) / 86400000 / 7) + 1 : 1;
  const readyForReintro = currentPhase === 'elimination' && elimWeek >= 4;

  const StatusBadge = ({ status }) => {
    if (status === 'current') return <View style={s.badge}><Text style={s.badgeText}>{t('plan_status_current')}</Text></View>;
    if (status === 'completed') return <View style={[s.badgeGreen, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}><CheckIcon color={s.badgeGreenText.color} size={11} /><Text style={s.badgeGreenText}>{t('plan_status_completed')}</Text></View>;
    return <View style={[s.badge, { backgroundColor: '#f0f4f0' }]}><Text style={[s.badgeText, { color: '#647264' }]}>{t('plan_status_upcoming')}</Text></View>;
  };

  const PhaseHeader = ({ band, illustration, eyebrow, title, status }) => (
    <View>
      <View style={{ backgroundColor: band, alignItems: 'center', paddingTop: 18, paddingBottom: 12, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
        {illustration}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: THEME.textMuted }}>{eyebrow}</Text>
          <Text style={{ fontSize: 20, fontWeight: '700', color: THEME.ink, marginTop: 3, letterSpacing: -0.3 }}>{title}</Text>
        </View>
        <View style={{ marginTop: 2 }}><StatusBadge status={status} /></View>
      </View>
    </View>
  );

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false} stickyHeaderIndices={[0]}>
      <View style={[s.headerRow, { paddingBottom: 12, backgroundColor: THEME.bg }]}>
        <View style={{ flex: 1 }}><Text accessibilityRole="header" style={s.h1}>{t('plan_title')}</Text><Text style={s.sub}>{t('plan_sub')}</Text></View>
      </View>

      {periodActive && reintroStatus === 'current' && (
        <Surface elevation={1} primaryColor={THEME.primary} style={[s.cardFilled, { backgroundColor: '#fffbf0' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 20 }}>🩸</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600' }}>{t('plan_period_pause')}</Text>
              <Text style={{ fontSize: 12, color: '#6b7a6b', lineHeight: 17, marginTop: 4 }}>{t('plan_period_pause_sub')}</Text>
            </View>
          </View>
        </Surface>
      )}

      <Surface elevation={1} primaryColor={THEME.primary} style={{ marginHorizontal: 20, marginBottom: 16, backgroundColor: THEME.card, borderRadius: THEME.rCard, opacity: eliminationStatus === 'upcoming' ? 0.85 : 1 }}>
        <PhaseHeader band="#eef5ee" illustration={<FloraPauseB width={196} />} eyebrow={t('plan_phase1_eyebrow')} title={t('plan_phase1_title')} status={eliminationStatus} />
        <View style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18 }}>
          <Text style={{ fontSize: 13, color: THEME.textSoft, lineHeight: 20, marginBottom: 14 }}>
            {t('plan_phase1_body')}
          </Text>
          {eliminationStatus === 'current' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f5faf5', borderRadius: 12, padding: 12 }}>
              <Text style={{ fontSize: 16 }}>🌿</Text>
              <Text style={{ flex: 1, fontSize: 12, color: '#2d6a2d', fontWeight: '600', lineHeight: 17 }}>{t('plan_elim_in_progress')}</Text>
            </View>
          )}
          {eliminationStatus === 'upcoming' && (
            <TouchableOpacity onPress={onStartElimination} style={[s.btnPrimary, { marginTop: 0 }]}>
              <Text style={s.btnPrimaryText}>{t('home_start_elim')}</Text>
            </TouchableOpacity>
          )}
          {eliminationStatus === 'completed' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f0f7f0', borderRadius: 12, padding: 12 }}>
              <CheckIcon color="#2d6a2d" size={16} />
              <Text style={{ flex: 1, fontSize: 12, color: '#2d6a2d', fontWeight: '600', lineHeight: 17 }}>{t('plan_elim_done')}</Text>
            </View>
          )}
        </View>
      </Surface>

      <Surface elevation={1} primaryColor={THEME.primary} style={{ marginHorizontal: 20, marginBottom: 16, backgroundColor: THEME.card, borderRadius: THEME.rCard }}>
        <PhaseHeader band="#fdf3e3" illustration={<FloraExplore width={196} />} eyebrow={t('plan_phase2_eyebrow')} title={t('plan_phase2_title')} status={reintroStatus} />
        <View style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18 }}>
          <Text style={{ fontSize: 13, color: THEME.textSoft, lineHeight: 20, marginBottom: 14 }}>
            {t('plan_phase2_body')}
          </Text>
          {reintroStatus === 'upcoming' && !readyForReintro && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f0f4f0', borderRadius: 12, padding: 12 }}>
              <Text style={{ fontSize: 16 }}>🔒</Text>
              <Text style={{ flex: 1, fontSize: 12, color: '#647264', fontWeight: '600' }}>{t('plan_reintro_locked')}</Text>
            </View>
          )}
          {reintroStatus === 'upcoming' && readyForReintro && (
            <TouchableOpacity onPress={onStartReintroduction} style={[s.btnPrimary, { marginTop: 0 }]}>
              <Text style={s.btnPrimaryText}>{t('plan_start_reintro')}</Text>
            </TouchableOpacity>
          )}

        {reintroStatus === 'current' && (
          <View style={{ marginTop: 0 }}>
            {activeTest && <ActiveTestCard test={activeTest} onLogDay={onLogReintroDay} onCancel={onCancelTest} t={t} />}
            {!activeTest && nextAction && (
              <View style={{ padding: 14, borderRadius: 14, backgroundColor: '#f5faf5', borderWidth: 1, borderColor: '#e0f0e0', marginBottom: 12 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#4e7d4e', marginBottom: 4 }}>{t('plan_what_now')}</Text>
                <Text style={{ fontSize: 13, color: '#2d3a2d', lineHeight: 19 }}>{nextAction.text}</Text>
              </View>
            )}

            <Text style={{ fontSize: 13, fontWeight: '600', marginTop: 8, marginBottom: 8 }}>{t('plan_categories', { n: Object.keys(reintroProgress).length })}</Text>
            {REINTRO_ORDER.map((step, i) => {
              const status = reintroProgress[step.id];
              const isActiveTest = activeTest?.categoryId === step.id;
              const completedCount = Object.keys(reintroProgress).length;
              // Free users may complete `freeReintroLimit` categories. Beyond that, remaining ones are Premium.
              const premiumLocked = !isPremium && !status && !isActiveTest && completedCount >= freeReintroLimit;
              const isAvailable = !activeTest && !status && nextAction.type === 'ready' && !premiumLocked;
              const colors = status === 'tolerated' ? { bg: '#e0f0e0', text: '#2d6a2d', icon: null }
                : status === 'trigger' ? { bg: '#fde0e0', text: '#a03030', icon: '✕' }
                : isActiveTest ? { bg: '#fff4d0', text: '#b87a1a', icon: '⏳', border: '#d4a040' }
                : premiumLocked ? { bg: '#f5faf5', text: '#4e7d4e', icon: '🌱' }
                : isAvailable ? { bg: '#e8f0e8', text: '#4e7d4e', icon: '▶' }
                : { bg: '#f0f4f0', text: '#b0c0b0', icon: '🔒' };
              const statusText = status === 'tolerated' ? t('plan_tolerated') : status === 'trigger' ? t('plan_trigger') : isActiveTest ? t('plan_in_progress') : premiumLocked ? t('plan_premium_tap') : isAvailable ? t('plan_tap_start') : t('plan_locked_until');
              return (
                <TouchableOpacity key={step.id} onPress={() => { if (premiumLocked) onUpsell(); else if (isAvailable) onPickTestCategory(step.id); }} disabled={!isAvailable && !premiumLocked} accessibilityRole="button" accessibilityLabel={`${step.name}: ${statusText}`} accessibilityState={{ disabled: !isAvailable && !premiumLocked }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8, backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: premiumLocked ? '#cfe0cf' : '#f0f4f0' }}>
                  <View importantForAccessibility="no" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', borderWidth: colors.border ? 2 : 0, borderColor: colors.border }}>
                    {status === 'tolerated' ? <CheckIcon color={colors.text} size={16} /> : <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{colors.icon}</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500' }}>{step.emoji} {step.name}</Text>
                    <Text style={{ fontSize: 11, color: premiumLocked ? '#4e7d4e' : '#647264', marginTop: 2 }}>
                      {statusText}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {!isPremium && Object.keys(reintroProgress).length >= freeReintroLimit && (
              <TouchableOpacity onPress={onUpsell} style={{ marginTop: 4, padding: 14, borderRadius: 14, backgroundColor: '#f5faf5', borderWidth: 1, borderColor: '#c4cec4' }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#2d6a2d', marginBottom: 2 }}>{t('plan_continue_reintro_title')}</Text>
                <Text style={{ fontSize: 12, color: '#6b7a6b', lineHeight: 17 }}>
                  {t('plan_continue_reintro_body')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        </View>
      </Surface>

      <View style={{ marginHorizontal: 20, marginTop: 4, padding: 12, borderRadius: 12, backgroundColor: '#f0f4f0' }}>
        <Text style={{ fontSize: 11, color: '#6b7a6b', lineHeight: 16 }}>
          {t('plan_disclaimer')}
        </Text>
      </View>
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

function ActiveTestCard({ test, onLogDay, onCancel, t }) {
  if (!test) return null;
  const cat = REINTRO_ORDER.find(r => r.id === test.categoryId);
  const food = TEST_FOODS_PER_CATEGORY[test.categoryId]?.find(f => f.id === test.foodId);
  const today = new Date();
  const startDate = new Date(test.startDate);
  const dayNum = Math.min(3, Math.floor((today - startDate) / 86400000) + 1);
  const todayLog = test.days.find(d => d.day === dayNum);
  const portion = dayNum === 1 ? food?.small : dayNum === 2 ? food?.medium : food?.large;
  const nextPortionLabel = dayNum === 1 ? food?.medium : food?.large;

  return (
    <View style={{ padding: 14, borderRadius: 14, backgroundColor: '#fffbf0', borderWidth: 2, borderColor: '#fff4d0', marginBottom: 12 }}>
      <View style={s.badge}><Text style={s.badgeText}>{t ? t('test_active_badge', { day: dayNum }) : `ACTIVE TEST - DAY ${dayNum} OF 3`}</Text></View>
      <Text style={{ fontSize: 16, fontWeight: '600', marginTop: 8 }}>{cat?.emoji} {cat?.name}: {food?.name}</Text>
      <Text style={{ fontSize: 13, color: '#6b7a6b', marginTop: 4 }}>{t ? t('test_portion', { portion }) : `Today's portion: ${portion}`}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        {test.days.map(d => {
          const bg = !d.completed ? '#e8efe8' : d.reacted ? '#c85050' : '#4e7d4e';
          return <View key={d.day} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: bg }} />;
        })}
      </View>
      {!todayLog?.completed ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <TouchableOpacity onPress={() => onLogDay(dayNum, false, 0)} style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#4e7d4e', alignItems: 'center' }}>
            <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>{t ? t('test_no_reaction') : 'No reaction'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onLogDay(dayNum, true, 3)} style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#c85050', alignItems: 'center' }}>
            <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>{t ? t('test_reacted') : 'Reacted'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={{ marginTop: 12, fontSize: 13, color: '#6b7a6b' }}>
          {t ? (dayNum < 3 ? t('test_day_logged_next', { day: dayNum, portion: nextPortionLabel }) : t('test_day_logged_done', { day: dayNum })) : `Day ${dayNum} logged.`}
        </Text>
      )}
      <TouchableOpacity onPress={onCancel} style={{ marginTop: 10, alignItems: 'center' }}>
        <Text style={{ fontSize: 12, color: '#647264' }}>{t ? t('test_cancel') : 'Cancel test'}</Text>
      </TouchableOpacity>
    </View>
  );
}

function GutGuideScreen({ t: tr, lang }) {
  const [topic, setTopic] = useState('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);

  const list = GUT_GUIDE.filter(item => {
    if (topic !== 'all' && item.topic !== topic) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const txt = guideText(item, lang);
      return txt.q.toLowerCase().indexOf(q) >= 0 || txt.a.toLowerCase().indexOf(q) >= 0
        || item.q.toLowerCase().indexOf(q) >= 0 || item.a.toLowerCase().indexOf(q) >= 0;
    }
    return true;
  });

  return (
    <View style={{ flex: 1 }}>
      <View style={s.headerRow}>
        <View style={{ flex: 1 }}><Text accessibilityRole="header" style={s.h1}>{tr('guide_title')}</Text><Text style={s.sub}>{tr('guide_sub')}</Text></View>
      </View>
      <View style={{ alignItems: 'center', marginBottom: 16, marginTop: 6 }}>
        <View style={{ width: 152, height: 152, borderRadius: 76, backgroundColor: '#edf5e7', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 124, height: 124, borderRadius: 62, backgroundColor: '#e2efd9', alignItems: 'center', justifyContent: 'center' }}>
            <FloraGuide size={104} />
          </View>
        </View>
      </View>
      <View style={{ marginHorizontal: 20, marginBottom: 14, backgroundColor: '#e6ede6', borderRadius: 28, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 52 }}>
        <View style={{ marginRight: 10 }}><SearchIcon size={20} /></View>
        <TextInput accessibilityLabel={tr('guide_search')} value={search} onChangeText={setSearch} placeholder={tr('guide_search')} placeholderTextColor="#6b7a6b" style={{ flex: 1, paddingVertical: 12, fontSize: 16 }} />
        {search ? <TouchableOpacity onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel={tr('a11y_clear')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.6} style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#16210f', alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}><XIcon size={13} color="#ffffff" /></TouchableOpacity> : null}
      </View>
      <View style={{ height: 44, marginBottom: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, alignItems: 'center' }}>
          {GUT_GUIDE_TOPICS.map(t => {
            const on = topic === t.id;
            return (
              <TouchableOpacity key={t.id} onPress={() => setTopic(t.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={guideTopicLabel(t.id, t.label, lang)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: on ? '#dcebdc' : 'transparent', borderWidth: 1, borderColor: on ? '#dcebdc' : '#c4cec4' }}>
                {on && <CheckIcon color="#2d6a2d" size={24} />}
                <Text style={{ fontSize: 14, fontWeight: on ? '600' : '500', color: on ? '#2d6a2d' : '#2d3a2d' }}>{guideTopicLabel(t.id, t.label, lang)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 11, color: '#647264', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginHorizontal: 20, marginBottom: 8, marginTop: 4 }}>{tr('guide_count', { n: list.length })}</Text>
        {list.map(item => {
          const open = openId === item.id;
          const txt = guideText(item, lang);
          return (
            <View key={item.id} style={{ marginHorizontal: 20, marginBottom: 10, backgroundColor: open ? '#f5faf5' : 'white', borderRadius: 18, borderWidth: 1, borderColor: open ? '#cfe0cf' : THEME.cardBorder, overflow: 'hidden' }}>
              <TouchableOpacity onPress={() => setOpenId(open ? null : item.id)} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={txt.q} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: THEME.ink, lineHeight: 19 }}>{txt.q}</Text>
                <View importantForAccessibility="no" style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: open ? THEME.primary : '#e8f0e8', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', lineHeight: 18, color: open ? 'white' : THEME.primaryDark }}>{open ? '−' : '+'}</Text>
                </View>
              </TouchableOpacity>
              {open && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 0 }}>
                  <View style={{ height: 1, backgroundColor: '#dfeadf', marginBottom: 12 }} />
                  <Text style={{ fontSize: 13, color: '#4a5a4a', lineHeight: 21 }}>{txt.a}</Text>
                </View>
              )}
            </View>
          );
        })}
        {list.length === 0 && (
          <View style={{ alignItems: 'center', padding: 30 }}>
            <Flora size={84} mood="soso" />
            <Text style={{ fontSize: 14, color: '#6b7a6b', textAlign: 'center', marginTop: 8 }}>{tr('guide_no_results')}</Text>
          </View>
        )}
        <View style={{ marginHorizontal: 20, marginTop: 8, marginBottom: 4, padding: 12, borderRadius: 12, backgroundColor: '#f0f4f0' }}>
          <Text style={{ fontSize: 11, color: '#6b7a6b', lineHeight: 16 }}>
            GutGuide gives general, evidence-informed information — not medical advice. For decisions about your care, talk to your doctor or a FODMAP-trained dietitian.
          </Text>
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

// Tabler search icon (outline, 2px) for search fields.
// All app icons are Tabler icons (outline, 2px stroke), inlined as SVG paths so
// there's no runtime dependency — react-native-svg is already used everywhere.
function TablerIcon({ size = 24, color, paths, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
      {paths.map((d, i) => <Path key={i} d={d} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />)}
    </Svg>
  );
}

// Solid/filled Tabler icon variant — these are separate solid-shape path sets (not the outline
// paths with fill added), so they need their own renderer with no stroke.
function TablerIconFilled({ size = 24, color, paths, style }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style}>
      {paths.map((d, i) => <Path key={i} d={d} />)}
    </Svg>
  );
}

function SearchIcon({ size = 24, color = '#647264' }) {
  return <TablerIcon size={size} color={color} paths={['M3 10a7 7 0 1 0 14 0a7 7 0 1 0 -14 0', 'M21 21l-6 -6']} />;
}

function CheckIcon({ size = 24, color = '#4e7d4e' }) {
  return <TablerIcon size={size} color={color} paths={['M5 12l5 5l10 -10']} />;
}

function IconArrowLeft({ size = 24, color = THEME.ink }) {
  return <TablerIcon size={size} color={color} paths={['M5 12l14 0', 'M5 12l6 6', 'M5 12l6 -6']} />;
}

function IconX({ size = 24, color = THEME.ink }) {
  return <TablerIcon size={size} color={color} paths={['M18 6l-12 12', 'M6 6l12 12']} />;
}

function IconPlus({ size = 24, color = THEME.ink }) {
  return <TablerIcon size={size} color={color} paths={['M12 5l0 14', 'M5 12l14 0']} />;
}

function IconMinus({ size = 24, color = THEME.ink, style }) {
  return <TablerIcon size={size} color={color} paths={['M5 12l14 0']} style={style} />;
}

function IconLock({ size = 24, color = THEME.ink }) {
  return <TablerIcon size={size} color={color} paths={['M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6', 'M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0', 'M8 11v-4a4 4 0 1 1 8 0v4']} />;
}

function IconExternalLink({ size = 24, color = THEME.ink }) {
  return <TablerIcon size={size} color={color} paths={['M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6', 'M11 13l9 -9', 'M15 4h5v5']} />;
}

function IconReportMedical({ size = 24, color = THEME.ink }) {
  return <TablerIcon size={size} color={color} paths={['M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2', 'M9 5a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2', 'M10 14l4 0', 'M12 12l0 4']} />;
}

function IconDropletFilled({ size = 24, color = THEME.ink }) {
  return <TablerIconFilled size={size} color={color} paths={['M10.708 2.372a2.382 2.382 0 0 0 -.71 .686l-4.892 7.26c-1.981 3.314 -1.22 7.466 1.767 9.882c2.969 2.402 7.286 2.402 10.254 0c2.987 -2.416 3.748 -6.569 1.795 -9.836l-4.919 -7.306c-.722 -1.075 -2.192 -1.376 -3.295 -.686z']} />;
}

function IconAlertTriangleFilled({ size = 24, color = THEME.ink }) {
  return <TablerIconFilled size={size} color={color} paths={['M12 1.67c.955 0 1.845 .467 2.39 1.247l.105 .16l8.114 13.548a2.914 2.914 0 0 1 -2.307 4.363l-.195 .008h-16.225a2.914 2.914 0 0 1 -2.582 -4.2l.099 -.185l8.11 -13.538a2.914 2.914 0 0 1 2.491 -1.403zm.01 13.33l-.127 .007a1 1 0 0 0 0 1.986l.117 .007l.127 -.007a1 1 0 0 0 0 -1.986l-.117 -.007zm-.01 -7a1 1 0 0 0 -.993 .883l-.007 .117v4l.007 .117a1 1 0 0 0 1.986 0l.007 -.117v-4l-.007 -.117a1 1 0 0 0 -.993 -.883z']} />;
}

function IconWorld({ size = 24, color = THEME.ink }) {
  return <TablerIcon size={size} color={color} paths={['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M3.6 9h16.8', 'M3.6 15h16.8', 'M11.5 3a17 17 0 0 0 0 18', 'M12.5 3a17 17 0 0 1 0 18']} />;
}

function IconCalendarWeekFilled({ size = 24, color = THEME.ink }) {
  return <TablerIconFilled size={size} color={color} paths={['M16 2c.183 0 .355 .05 .502 .135l.033 .02c.28 .177 .465 .49 .465 .845v1h1a3 3 0 0 1 2.995 2.824l.005 .176v12a3 3 0 0 1 -2.824 2.995l-.176 .005h-12a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-12a3 3 0 0 1 2.824 -2.995l.176 -.005h1v-1a1 1 0 0 1 .514 -.874l.093 -.046l.066 -.025l.1 -.029l.107 -.019l.12 -.007q .083 0 .161 .013l.122 .029l.04 .012l.06 .023c.328 .135 .568 .44 .61 .806l.007 .117v1h6v-1a1 1 0 0 1 1 -1m3 7h-14v9.625c0 .705 .386 1.286 .883 1.366l.117 .009h12c.513 0 .936 -.53 .993 -1.215l.007 -.16z', 'M9.015 13a1 1 0 0 1 -1 1a1.001 1.001 0 1 1 -.005 -2c.557 0 1.005 .448 1.005 1', 'M13.015 13a1 1 0 0 1 -1 1a1.001 1.001 0 1 1 -.005 -2c.557 0 1.005 .448 1.005 1', 'M17.02 13a1 1 0 0 1 -1 1a1.001 1.001 0 1 1 -.005 -2c.557 0 1.005 .448 1.005 1', 'M12.02 15a1 1 0 0 1 0 2a1.001 1.001 0 1 1 -.005 -2z', 'M9.015 16a1 1 0 0 1 -1 1a1.001 1.001 0 1 1 -.005 -2c.557 0 1.005 .448 1.005 1']} />;
}

function BarcodeIcon({ size = 24, color = THEME.ink }) {
  return <TablerIcon size={size} color={color} paths={['M4 7v-1a2 2 0 0 1 2 -2h2', 'M4 17v1a2 2 0 0 0 2 2h2', 'M16 4h2a2 2 0 0 1 2 2v1', 'M16 20h2a2 2 0 0 0 2 -2v-1', 'M5 11h1v2h-1l0 -2', 'M10 11l0 2', 'M14 11h1v2h-1l0 -2', 'M19 11l0 2']} />;
}

function KitchenIcon({ size = 24, color = THEME.ink }) {
  return <TablerIcon size={size} color={color} paths={['M19 3v12h-5c-.023 -3.681 .184 -7.406 5 -12m0 12v6h-1v-3m-10 -14v17m-3 -17v3a3 3 0 1 0 6 0v-3']} />;
}

function ChevronIcon({ size = 24, color = '#647264' }) {
  return <TablerIcon size={size} color={color} paths={['M9 6l6 6l-6 6']} />;
}

// Tabler "x" — a proper 2pt outline close/clear icon (replaces the ✕ text glyph).
function XIcon({ size = 24, color = THEME.ink }) {
  return <TablerIcon size={size} color={color} paths={['M18 6l-12 12', 'M6 6l12 12']} />;
}

// Password visibility toggle. `off` shows the crossed-out eye (currently visible → tap to hide).
function EyeIcon({ size = 24, color = '#647264', off = false }) {
  return <TablerIcon size={size} color={color} paths={off
    ? ['M10.585 10.587a2 2 0 0 0 2.829 2.828', 'M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-4 0 -7.333 -2.333 -10 -7c.847 -1.482 1.809 -2.74 2.865 -3.773m2.925 -1.766a9.9 9.9 0 0 1 4.21 -.961c4 0 7.333 2.333 10 7c-.556 .973 -1.146 1.836 -1.766 2.59', 'M3 3l18 18']
    : ['M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M22 12c-2.667 4.667 -6 7 -10 7s-7.333 -2.333 -10 -7c2.667 -4.667 6 -7 10 -7s7.333 2.333 10 7']} />;
}

function BulbIcon({ size = 24, color = THEME.amberText }) {
  return <TablerIcon size={size} color={color} paths={['M3 12h1m8 -9v1m8 8h1m-15.4 -6.4l.7 .7m12.1 -.7l-.7 .7', 'M9 16a5 5 0 1 1 6 0a3.5 3.5 0 0 0 -1 3a2 2 0 0 1 -4 0a3.5 3.5 0 0 0 -1 -3', 'M9.7 17l4.6 0']} />;
}

// Reusable shimmer placeholder for genuinely-async content (barcode lookup, AI scan, and
// future remote fetches). Pulses its opacity; honours the OS "Reduce Motion" setting.
function Skeleton({ width = '100%', height = 14, radius = 8, style }) {
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (_reduceMotion) { pulse.setValue(0.7); return; }
    const anim = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.5, duration: 650, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
  }, []);
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: '#e4e9e4', opacity: pulse }, style]} />;
}

// Skeleton of a scan result card (used while a barcode/AI lookup is in flight) — mirrors
// the real result layout (label, product name, risk block) so the fill-in is seamless.
function ScanResultSkeleton({ label }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#fafbfa' }}>
      <View style={{ padding: 24 }}>
        {label ? <Text style={{ fontSize: 11, color: '#647264', fontWeight: '600', marginBottom: 12 }}>{label}</Text> : null}
        <Skeleton width={'70%'} height={26} radius={6} />
        <Skeleton width={'40%'} height={13} radius={4} style={{ marginTop: 10 }} />
        <Skeleton width={'100%'} height={96} radius={20} style={{ marginTop: 18 }} />
        <Skeleton width={'100%'} height={104} radius={16} style={{ marginTop: 16 }} />
      </View>
    </ScrollView>
  );
}

// Shared meal-of-day selector — one component reused everywhere. Chips size to their
// content with a constant horizontal padding, so the check makes a chip wider without
// ever shrinking its left/right padding. Wraps on long locales instead of squeezing.
function MealTypeSelector({ value, onChange, t, style }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style} contentContainerStyle={{ flexDirection: 'row', gap: 8 }}>
      {MEAL_TYPES.map(mt => {
        const on = value === mt.id;
        return (
          <TouchableOpacity key={mt.id} onPress={() => onChange(mt.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={t('meal_type_' + mt.id)} style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: on ? '#dcebdc' : '#c4cec4', backgroundColor: on ? '#dcebdc' : 'transparent' }}>
            {on && <CheckIcon color="#2d6a2d" size={24} />}
            <Text importantForAccessibility="no" numberOfLines={1} style={{ fontSize: 14, fontWeight: on ? '600' : '500', color: on ? '#2d6a2d' : '#2d3a2d' }}>{t('meal_type_' + mt.id)}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function ChevronDownIcon({ size = 24, color = '#647264' }) {
  return <TablerIcon size={size} color={color} paths={['M6 9l6 6l6 -6']} />;
}

// Tabler bottom-nav icons. `outline` renders for inactive tabs (2px stroke);
// `filled` renders for the selected tab — each entry is { d, mode } where mode is
// 'fill' (solid), 'fillEven' (solid with holes), 'stroke' (accent line), or
// 'white' (knocked-out inner detail). today/foods/plan use the supplied filled
// assets; guide is built from its outline.
const TAB_ICONS = {
  today: {
    fillBased: true,
    outline: 'M11.2128 20.7876C10.9993 20.5739 10.8925 20.3115 10.8925 20.0004V13.1449C9.82968 13.133 8.8086 12.9199 7.82926 12.5056C6.84993 12.0913 5.98526 11.5091 5.23526 10.7591C4.47376 9.99794 3.88993 9.11844 3.48376 8.12061C3.0776 7.12278 2.87451 6.08269 2.87451 5.00036V4.01836C2.87451 3.69919 2.98426 3.42978 3.20376 3.21011C3.42343 2.99061 3.69284 2.88086 4.01201 2.88086H4.99401C6.05951 2.88086 7.09126 3.08811 8.08926 3.50261C9.0871 3.91728 9.9666 4.50528 10.7278 5.26661C11.2244 5.76344 11.6416 6.30919 11.9793 6.90386C12.3169 7.49869 12.5814 8.13211 12.7728 8.80411C12.8396 8.71128 12.913 8.62169 12.993 8.53536C13.0732 8.44919 13.1599 8.35961 13.2533 8.26661C14.0143 7.50528 14.8937 6.91728 15.8915 6.50261C16.8893 6.08811 17.9295 5.88086 19.012 5.88086H19.994C20.3132 5.88086 20.5826 5.99061 20.8023 6.21011C21.0218 6.42978 21.1315 6.69919 21.1315 7.01836V8.00036C21.1315 9.08269 20.9243 10.1228 20.5098 11.1206C20.0951 12.1184 19.5071 12.9979 18.7458 13.7591C17.9958 14.5091 17.1343 15.0871 16.1613 15.4931C15.1883 15.8991 14.1703 16.108 13.1075 16.1199V20.0004C13.1075 20.3115 13.0008 20.5739 12.7873 20.7876C12.5736 21.0011 12.3112 21.1079 12 21.1079C11.6888 21.1079 11.4264 21.0011 11.2128 20.7876ZM10.8983 10.8986C10.8983 10.1624 10.7471 9.44186 10.4448 8.73686C10.1424 8.03169 9.71193 7.39978 9.15326 6.84111C8.6066 6.29444 7.98568 5.87086 7.29051 5.57036C6.59534 5.27003 5.86376 5.11394 5.09576 5.10211C5.1076 5.87411 5.2596 6.61086 5.55176 7.31236C5.84376 8.01386 6.2631 8.63794 6.80976 9.18461C7.3566 9.73128 7.98168 10.1507 8.68501 10.4429C9.38851 10.7349 10.1263 10.8868 10.8983 10.8986ZM13.1135 13.9046C13.8498 13.9046 14.5705 13.7576 15.2755 13.4636C15.9807 13.1696 16.6126 12.7433 17.1713 12.1846C17.7179 11.6379 18.1414 11.0139 18.4418 10.3124C18.7423 9.61086 18.8984 8.87411 18.9103 8.10211C18.1383 8.11394 17.4015 8.27003 16.7 8.57036C15.9985 8.87086 15.3744 9.29444 14.8278 9.84111C14.2809 10.3878 13.8615 11.0097 13.5695 11.7069C13.2775 12.404 13.1255 13.1366 13.1135 13.9046Z',
    filledPath: 'M11.2128 20.7876C10.9993 20.5739 10.8925 20.3115 10.8925 20.0004V13.1449C9.82968 13.133 8.8086 12.9199 7.82926 12.5056C6.84993 12.0913 5.98526 11.5091 5.23526 10.7591C4.47376 9.99794 3.88993 9.11844 3.48376 8.12061C3.0776 7.12278 2.87451 6.08269 2.87451 5.00036V4.01836C2.87451 3.69919 2.98426 3.42978 3.20376 3.21011C3.42343 2.99061 3.69284 2.88086 4.01201 2.88086H4.99401C6.05951 2.88086 7.09126 3.08811 8.08926 3.50261C9.0871 3.91728 9.96659 4.50528 10.7278 5.26661C11.2244 5.76344 11.6416 6.30919 11.9793 6.90386C12.3169 7.49869 12.5814 8.13211 12.7728 8.80411C12.8396 8.71128 12.913 8.62169 12.993 8.53536C13.0732 8.44919 13.1599 8.35961 13.2533 8.26661C14.0143 7.50528 14.8937 6.91728 15.8915 6.50261C16.8893 6.08811 17.9295 5.88086 19.012 5.88086H19.994C20.3132 5.88086 20.5826 5.99061 20.8023 6.21011C21.0218 6.42978 21.1315 6.69919 21.1315 7.01836V8.00036C21.1315 9.08269 20.9243 10.1228 20.5098 11.1206C20.0951 12.1184 19.5071 12.9979 18.7458 13.7591C17.9958 14.5091 17.1343 15.0871 16.1613 15.4931C15.1883 15.8991 14.1703 16.108 13.1075 16.1199V20.0004C13.1075 20.3115 13.0008 20.5739 12.7873 20.7876C12.5736 21.0011 12.3112 21.1079 12 21.1079C11.6888 21.1079 11.4264 21.0011 11.2128 20.7876Z',
  },
  foods: {
    outline: ['M13.62 8.382l1.966 -1.967a2 2 0 1 1 3.414 -1.415a2 2 0 1 1 -1.413 3.414l-1.82 1.821', 'M5.904 18.596c2.733 2.734 5.9 4 7.07 2.829c1.172 -1.172 -.094 -4.338 -2.828 -7.071c-2.733 -2.734 -5.9 -4 -7.07 -2.829c-1.172 1.172 .094 4.338 2.828 7.071', 'M7.5 16l1 1', 'M12.975 21.425c3.905 -3.906 4.855 -9.288 2.121 -12.021c-2.733 -2.734 -8.115 -1.784 -12.02 2.121'],
    filled: [
      { d: 'M13.62 8.382L15.586 6.415C15.3534 6.18247 15.1817 5.89618 15.0862 5.58146C14.9907 5.26675 14.9742 4.93334 15.0384 4.61075C15.1025 4.28817 15.2451 3.98638 15.4537 3.7321C15.6623 3.47782 15.9304 3.27891 16.2342 3.15298C16.5381 3.02705 16.8682 2.978 17.1956 3.01016C17.5229 3.04232 17.8372 3.1547 18.1107 3.33735C18.3842 3.52001 18.6085 3.76729 18.7636 4.0573C18.9187 4.34732 18.9999 4.67111 19 5C19.329 4.99977 19.6529 5.08068 19.9431 5.23559C20.2334 5.39049 20.4809 5.61459 20.6638 5.88803C20.8467 6.16147 20.9593 6.47581 20.9917 6.80319C21.0241 7.13057 20.9752 7.46088 20.8494 7.76485C20.7236 8.06882 20.5247 8.33706 20.2705 8.5458C20.0162 8.75454 19.7144 8.89734 19.3917 8.96154C19.0691 9.02575 18.7356 9.00937 18.4208 8.91386C18.106 8.81835 17.8196 8.64666 17.587 8.414L15.767 10.235', mode: 'stroke' },
      { d: 'M5.90401 18.596C8.63701 21.33 11.804 22.596 12.974 21.425C14.146 20.253 12.88 17.087 10.146 14.354C7.41301 11.62 4.24601 10.354 3.07601 11.525C1.90401 12.697 3.17001 15.863 5.90401 18.596Z', mode: 'stroke' },
      { d: 'M7.5 16L8.5 17', mode: 'stroke' },
      { d: 'M12.975 21.425C16.88 17.519 17.83 12.137 15.096 9.404C12.363 6.67 6.98099 7.62 3.07599 11.525', mode: 'stroke' },
      { d: 'M15.02 9.5612C17.754 12.2942 17.405 16.594 13.5 20.5C13.0077 17.5702 11.5024 16.0198 10 14.5C7.77949 12.2538 5.5 10.5 3 11.6822C8.5 7 12.287 6.8272 15.02 9.5612Z', mode: 'fill' },
    ],
  },
  plan: {
    outline: ['M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2', 'M9 5a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2a2 2 0 0 1 -2 2h-2a2 2 0 0 1 -2 -2', 'M9 12l.01 0', 'M13 12l2 0', 'M9 16l.01 0', 'M13 16l2 0'],
    filled: [
      { d: 'M17.997 4.17a3 3 0 0 1 2.003 2.83v12a3 3 0 0 1 -3 3h-10a3 3 0 0 1 -3 -3v-12a3 3 0 0 1 2.003 -2.83a4 4 0 0 0 3.997 3.83h4a4 4 0 0 0 3.98 -3.597zm-8.987 10.83h-.01a1 1 0 0 0 -.117 1.993l.127 .007a1 1 0 0 0 0 -2m5.99 0h-2a1 1 0 0 0 0 2h2a1 1 0 0 0 0 -2m-5.99 -4h-.01a1 1 0 0 0 -.117 1.993l.127 .007a1 1 0 0 0 0 -2m5.99 0h-2a1 1 0 0 0 0 2h2a1 1 0 0 0 0 -2m-1 -9a2 2 0 1 1 0 4h-4a2 2 0 1 1 0 -4z', mode: 'fillEven' },
    ],
  },
  guide: {
    fillBased: true,
    outline: 'M12.8644 17.6166C13.1199 17.3611 13.2476 17.0501 13.2476 16.6836C13.2476 16.3171 13.1199 16.0073 12.8644 15.7541C12.6087 15.5011 12.2979 15.3746 11.9319 15.3746C11.566 15.3746 11.2553 15.5011 10.9996 15.7541C10.744 16.0073 10.6161 16.3171 10.6161 16.6836C10.6161 17.0501 10.744 17.3611 10.9996 17.6166C11.2553 17.8723 11.566 18.0001 11.9319 18.0001C12.2979 18.0001 12.6087 17.8723 12.8644 17.6166ZM11.9999 22.2034C10.5847 22.2034 9.25688 21.9357 8.01638 21.4004C6.77571 20.865 5.69655 20.1386 4.77888 19.2211C3.86138 18.3035 3.13496 17.2243 2.59963 15.9836C2.0643 14.7431 1.79663 13.4153 1.79663 12.0001C1.79663 10.585 2.0643 9.25712 2.59963 8.01662C3.13496 6.77596 3.86138 5.69679 4.77888 4.77912C5.69655 3.86162 6.77571 3.13521 8.01638 2.59987C9.25688 2.06454 10.5847 1.79688 11.9999 1.79688C13.415 1.79688 14.7429 2.06454 15.9834 2.59987C17.224 3.13521 18.3032 3.86162 19.2209 4.77912C20.1384 5.69679 20.8648 6.77596 21.4001 8.01662C21.9355 9.25712 22.2031 10.585 22.2031 12.0001C22.2031 13.4153 21.9355 14.7431 21.4001 15.9836C20.8648 17.2243 20.1384 18.3035 19.2209 19.2211C18.3032 20.1386 17.224 20.865 15.9834 21.4004C14.7429 21.9357 13.415 22.2034 11.9999 22.2034ZM11.9999 19.9284C14.2172 19.9284 16.093 19.1614 17.6271 17.6274C19.1611 16.0932 19.9281 14.2175 19.9281 12.0001C19.9281 9.78279 19.1611 7.90704 17.6271 6.37287C16.093 4.83887 14.2172 4.07188 11.9999 4.07188C9.78255 4.07188 7.9068 4.83887 6.37263 6.37287C4.83863 7.90704 4.07163 9.78279 4.07163 12.0001C4.07163 14.2175 4.83863 16.0932 6.37263 17.6274C7.9068 19.1614 9.78255 19.9284 11.9999 19.9284ZM12.0819 7.82563C12.4664 7.82563 12.801 7.94988 13.0856 8.19838C13.3701 8.44688 13.5124 8.75746 13.5124 9.13013C13.5124 9.47679 13.4069 9.78579 13.1959 10.0571C12.9847 10.3286 12.7455 10.5814 12.4781 10.8154C12.0948 11.1487 11.7563 11.5174 11.4626 11.9214C11.169 12.3254 11.0221 12.7774 11.0221 13.2774C11.0221 13.5242 11.115 13.7314 11.3009 13.8989C11.4869 14.0664 11.7038 14.1501 11.9516 14.1501C12.2171 14.1501 12.4434 14.0618 12.6304 13.8851C12.8172 13.7085 12.9436 13.4892 13.0096 13.2274C13.0843 12.8932 13.2313 12.5956 13.4506 12.3346C13.6701 12.0736 13.9072 11.824 14.1619 11.5859C14.5452 11.2232 14.8704 10.8223 15.1374 10.3831C15.4044 9.94379 15.5379 9.45946 15.5379 8.93013C15.5379 8.07213 15.195 7.36729 14.5094 6.81563C13.8237 6.26396 13.0245 5.98813 12.1119 5.98813C11.4625 5.98813 10.8474 6.12546 10.2664 6.40013C9.68538 6.67479 9.23696 7.09113 8.92113 7.64913C8.79646 7.86096 8.7568 8.08729 8.80213 8.32813C8.84763 8.56896 8.97021 8.75188 9.16988 8.87688C9.41521 9.02204 9.67188 9.06662 9.93988 9.01062C10.2077 8.95479 10.433 8.80621 10.6156 8.56488C10.791 8.33071 11.0084 8.14896 11.2679 8.01963C11.5275 7.89029 11.7989 7.82563 12.0819 7.82563Z',
    filledPath: 'M12.8644 17.6166C13.1199 17.3611 13.2476 17.0501 13.2476 16.6836C13.2476 16.3171 13.1199 16.0073 12.8644 15.7541C12.6087 15.5011 12.2979 15.3746 11.9319 15.3746C11.566 15.3746 11.2553 15.5011 10.9996 15.7541C10.744 16.0073 10.6161 16.3171 10.6161 16.6836C10.6161 17.0501 10.744 17.3611 10.9996 17.6166C11.2553 17.8723 11.566 18.0001 11.9319 18.0001C12.2979 18.0001 12.6087 17.8723 12.8644 17.6166ZM11.9999 22.2034C10.5847 22.2034 9.25688 21.9357 8.01638 21.4004C6.77571 20.865 5.69655 20.1386 4.77888 19.2211C3.86138 18.3035 3.13496 17.2243 2.59963 15.9836C2.0643 14.7431 1.79663 13.4153 1.79663 12.0001C1.79663 10.585 2.0643 9.25712 2.59963 8.01662C3.13496 6.77596 3.86138 5.69679 4.77888 4.77912C5.69655 3.86162 6.77571 3.13521 8.01638 2.59987C9.25688 2.06454 10.5847 1.79688 11.9999 1.79688C13.415 1.79688 14.7429 2.06454 15.9834 2.59987C17.224 3.13521 18.3032 3.86162 19.2209 4.77912C20.1384 5.69679 20.8648 6.77596 21.4001 8.01662C21.9355 9.25712 22.2031 10.585 22.2031 12.0001C22.2031 13.4153 21.9355 14.7431 21.4001 15.9836C20.8648 17.2243 20.1384 18.3035 19.2209 19.2211C18.3032 20.1386 17.224 20.865 15.9834 21.4004C14.7429 21.9357 13.415 22.2034 11.9999 22.2034ZM12.0819 7.82563C12.4664 7.82563 12.801 7.94988 13.0856 8.19838C13.3701 8.44688 13.5124 8.75746 13.5124 9.13013C13.5124 9.47679 13.4069 9.78579 13.1959 10.0571C12.9847 10.3286 12.7455 10.5814 12.4781 10.8154C12.0948 11.1487 11.7563 11.5174 11.4626 11.9214C11.169 12.3254 11.0221 12.7774 11.0221 13.2774C11.0221 13.5242 11.115 13.7314 11.3009 13.8989C11.4869 14.0664 11.7038 14.1501 11.9516 14.1501C12.2171 14.1501 12.4434 14.0618 12.6304 13.8851C12.8172 13.7085 12.9436 13.4892 13.0096 13.2274C13.0843 12.8932 13.2313 12.5956 13.4506 12.3346C13.6701 12.0736 13.9072 11.824 14.1619 11.5859C14.5452 11.2232 14.8704 10.8223 15.1374 10.3831C15.4044 9.94379 15.5379 9.45946 15.5379 8.93013C15.5379 8.07213 15.195 7.36729 14.5094 6.81563C13.8237 6.26396 13.0245 5.98813 12.1119 5.98813C11.4625 5.98813 10.8474 6.12546 10.2664 6.40013C9.68538 6.67479 9.23696 7.09113 8.92113 7.64913C8.79646 7.86096 8.7568 8.08729 8.80213 8.32812C8.84763 8.56896 8.97021 8.75188 9.16988 8.87688C9.41521 9.02204 9.67188 9.06662 9.93988 9.01062C10.2077 8.95479 10.433 8.80621 10.6156 8.56488C10.791 8.33071 11.0084 8.14896 11.2679 8.01963C11.5275 7.89029 11.7989 7.82563 12.0819 7.82563Z',
  },
};
function TabIcon({ name, color, filled, size = 25 }) {
  const ic = TAB_ICONS[name];
  if (ic.fillBased) {
    // Single fill-path icons (Material-style). Even-odd fill rule renders the
    // cut-outs that give the outlined variant its hollow look.
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d={filled ? ic.filledPath : ic.outline} fill={color} fillRule="evenodd" />
      </Svg>
    );
  }
  if (!filled) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {ic.outline.map((d, i) => <Path key={i} d={d} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />)}
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {ic.filled.map((p, i) => {
        if (p.mode === 'fill') return <Path key={i} d={p.d} fill={color} />;
        if (p.mode === 'fillEven') return <Path key={i} d={p.d} fill={color} fillRule="evenodd" />;
        if (p.mode === 'fillStroke') return <Path key={i} d={p.d} fill={color} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />;
        if (p.mode === 'white') return <Path key={i} d={p.d} stroke="#ffffff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />;
        return <Path key={i} d={p.d} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />;
      })}
    </Svg>
  );
}

function TabBar({ current, setTab, onPlusPress, t }) {
  const insets = useSafeAreaInsets();
  const leftTabs = [{ id: 'home', icon: 'today', label: t('tab_home') }, { id: 'foods', icon: 'foods', label: t('tab_foods') }];
  const rightTabs = [{ id: 'plan', icon: 'plan', label: t('tab_plan') }, { id: 'chat', icon: 'guide', label: t('tab_guide') }];
  // Inline render (not a nested component) so switching tabs doesn't remount the buttons.
  // Switch on press-IN for instant response; keep onPress so screen readers still activate it
  // (setTab to the current tab is a no-op, so firing both is harmless). Big hitSlop + padding
  // give a generous, reliable tap target at the very bottom of the screen.
  const renderTab = (tab) => {
    const active = current === tab.id;
    const go = () => setTab(tab.id);
    return (
      <TouchableOpacity key={tab.id} style={s.tabBtn} onPressIn={go} onPress={go} activeOpacity={0.6} hitSlop={{ top: 12, bottom: 10, left: 6, right: 6 }} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={tab.label}>
        <TabIcon name={tab.icon} color={active ? '#4e7d4e' : '#9aa69a'} filled={active} size={25} />
        <Text style={{ fontSize: 9, fontWeight: '600', color: active ? '#4e7d4e' : '#647264', marginTop: 2 }}>{tab.label}</Text>
      </TouchableOpacity>
    );
  };
  return (
    <View style={[s.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {leftTabs.map(renderTab)}
      <TouchableOpacity style={s.plusBtn} onPress={onPlusPress} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={t('a11y_add_log')}>
        <View style={s.plusInner}><IconPlus size={24} color="#ffffff" /></View>
      </TouchableOpacity>
      {rightTabs.map(renderTab)}
    </View>
  );
}

function LogTypeChooserModal({ visible, onClose, onPick, t }) {
  const opts = [
    { id: 'meal', icon: '🍽️', label: t('log_meal'), sub: t('log_meal_sub') },
    { id: 'symptom', icon: '⚠️', label: t('log_symptom'), sub: t('log_symptom_sub') },
    { id: 'sleep', icon: '😴', label: t('log_sleep'), sub: t('log_sleep_sub') },
    { id: 'stress', icon: '🧘', label: t('log_stress'), sub: t('log_stress_sub') },
    { id: 'water', icon: '💧', label: t('log_water'), sub: t('log_water_sub') },
  ];
  return (
    <BottomSheet visible={visible} onClose={onClose}>
        <Surface accessibilityViewIsModal elevation={1} primaryColor={THEME.primary} style={{ backgroundColor: THEME.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: '700' }}>{t('log_chooser_title')}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')}><XIcon size={24} color="#647264" /></TouchableOpacity>
          </View>
          {opts.map(opt => (
            <Pressable key={opt.id} onPress={() => { onClose(); setTimeout(() => onPick(opt.id), 200); }} accessibilityRole="button" accessibilityLabel={`${opt.label}. ${opt.sub}`} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, backgroundColor: pressed ? '#dcebdc' : 'white', borderRadius: 16, marginBottom: 10 })}>
              <Text importantForAccessibility="no" style={{ fontSize: 28 }}>{opt.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600' }}>{opt.label}</Text>
                <Text style={{ fontSize: 12, color: '#647264', marginTop: 2 }}>{opt.sub}</Text>
              </View>
              <View importantForAccessibility="no"><ChevronIcon size={16} color="#647264" /></View>
            </Pressable>
          ))}
        </Surface>
    </BottomSheet>
  );
}

function SleepModal({ visible, onClose, onSave, t }) {
  const [hours, setHours] = useState(7);
  const [when, setWhen] = useState(new Date());
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaViewSC style={{ flex: 1, backgroundColor: '#fafbfa' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f4f0' }}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')} style={s.modalCloseBtn}><XIcon size={24} color={THEME.ink} /></TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '700' }}>{t('sleep_title')}</Text>
        </View>
        <ScrollView style={{ flex: 1 }}>
          <View style={{ padding: 20 }}>
            <DateTimeRow value={when} onChange={setWhen} />
            <Text style={{ fontSize: 13, color: '#6b7a6b', marginBottom: 12 }}>{t('sleep_hours_label', { n: hours })}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[4, 5, 6, 7, 8, 9, 10].map(h => (
                <TouchableOpacity key={h} onPress={() => setHours(h)} accessibilityRole="radio" accessibilityState={{ selected: hours === h }} accessibilityLabel={t('sleep_hours_label', { n: h })} style={{ width: 56, padding: 14, borderRadius: 12, backgroundColor: hours === h ? '#dcebdc' : 'transparent', borderWidth: 1, borderColor: hours === h ? '#dcebdc' : '#c4cec4', alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: hours === h ? '#2d6a2d' : '#2d3a2d' }}>{h}h</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => { onSave(hours, when); setHours(7); setWhen(new Date()); }} style={[s.btnPrimary, { marginTop: 24 }]}>
              <Text style={s.btnPrimaryText}>{t('save')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaViewSC>
    </Modal>
  );
}

function WaterModal({ visible, onClose, onSave, t }) {
  const [glasses, setGlasses] = useState(2);
  const [when, setWhen] = useState(new Date());
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaViewSC style={{ flex: 1, backgroundColor: '#fafbfa' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f4f0' }}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')} style={s.modalCloseBtn}><XIcon size={24} color={THEME.ink} /></TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '700' }}>{t('water_title')}</Text>
        </View>
        <ScrollView style={{ flex: 1 }}>
          <View style={{ padding: 20 }}>
            <DateTimeRow value={when} onChange={setWhen} />
            <Text style={{ fontSize: 13, color: '#6b7a6b', marginBottom: 4 }}>{t('water_amount_label')}</Text>
            <Text style={{ fontSize: 12, color: THEME.textMuted, marginBottom: 12 }}>{t('water_unit_hint')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => {
                const on = glasses === n;
                return (
                  <TouchableOpacity key={n} onPress={() => setGlasses(n)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={n === 1 ? t('water_glasses_one', { n }) : t('water_glasses', { n })} style={{ width: 56, paddingVertical: 12, borderRadius: 12, backgroundColor: on ? '#dcebdc' : 'transparent', borderWidth: 1, borderColor: on ? '#4e7d4e' : '#c4cec4', alignItems: 'center' }}>
                    <Text importantForAccessibility="no" style={{ fontSize: 20 }}>💧</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', marginTop: 2, color: on ? '#2d6a2d' : '#2d3a2d' }}>{n}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {/* The reminder — why staying hydrated matters for the gut */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#eef4fb', borderRadius: 14, padding: 14 }}>
              <Text importantForAccessibility="no" style={{ fontSize: 20 }}>💧</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#2f5b8a', marginBottom: 4 }}>{t('water_why_title')}</Text>
                <Text style={{ fontSize: 12.5, color: '#3d5266', lineHeight: 18 }}>{t('water_why')}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => { onSave(glasses, when); setGlasses(2); setWhen(new Date()); }} style={[s.btnPrimary, { marginTop: 20 }]}>
              <Text style={s.btnPrimaryText}>{t('save')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaViewSC>
    </Modal>
  );
}

function StressModal({ visible, onClose, onSave, t }) {
  const [level, setLevel] = useState(3);
  const [when, setWhen] = useState(new Date());
  const labels = [t('stress_calm'), t('stress_mild'), t('stress_manageable'), t('stress_tense'), t('stress_overwhelmed')];
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaViewSC style={{ flex: 1, backgroundColor: '#fafbfa' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f4f0' }}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')} style={s.modalCloseBtn}><XIcon size={24} color={THEME.ink} /></TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '700' }}>{t('stress_title')}</Text>
        </View>
        <ScrollView style={{ flex: 1 }}>
          <View style={{ padding: 20 }}>
            <DateTimeRow value={when} onChange={setWhen} />
            <Text style={{ fontSize: 13, color: '#6b7a6b', marginBottom: 12 }}>{t('stress_label', { label: labels[level - 1] })}</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} onPress={() => setLevel(n)} accessibilityRole="radio" accessibilityState={{ selected: level === n }} accessibilityLabel={`${n} – ${labels[n - 1]}`} style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: n <= level ? `hsl(${15 - (n - 1) * 3}, 60%, ${65 - (n - 1) * 5}%)` : '#f0f4f0', alignItems: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: n <= level ? 'white' : '#647264' }}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => { onSave(level, when); setLevel(3); setWhen(new Date()); }} style={[s.btnPrimary, { marginTop: 24 }]}>
              <Text style={s.btnPrimaryText}>{t('save')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaViewSC>
    </Modal>
  );
}

function BarcodeModal({ visible, onClose, onComplete, lang, t }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [barcodeWhen, setBarcodeWhen] = useState(new Date());

  // The modal stays mounted (visibility is prop-driven), so clear the last scan whenever it
  // closes — otherwise reopening it shows the previous product instead of the live camera.
  useEffect(() => {
    if (!visible) { setScanned(false); setResult(null); setLoading(false); }
    else { setBarcodeWhen(new Date()); }
  }, [visible]);

  const handleBarcode = async ({ data }) => {
    if (scanned) return;
    setScanned(true); setLoading(true);
    try {
      // Ask Open Food Facts for the name/ingredients in the app's language too — the base
      // `product_name` comes back in whatever language the product was entered in (often the
      // origin country's, e.g. Russian), which looked wrong to users on another locale.
      const fields = `product_name,product_name_${lang},product_name_en,brands,ingredients_text,ingredients_text_${lang},ingredients_text_en,allergens_tags`;
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${data}.json?fields=${fields}`);
      const json = await res.json();
      let product;
      if (json.status === 1 && json.product) {
        const p = json.product;
        // Prefer the app language, then English, then whatever was stored.
        const name = p['product_name_' + lang] || p.product_name_en || p.product_name || 'Unknown';
        const ingText = p['ingredients_text_' + lang] || p.ingredients_text_en || p.ingredients_text || '';
        // Scan every language variant we fetched so trigger detection still works even when
        // only the localized text is present.
        const ing = [p['ingredients_text_' + lang], p.ingredients_text_en, p.ingredients_text].filter(Boolean).join(' ').toLowerCase();
        const triggered = [];
        const high = {
          fructans: ['onion', 'zwiebel', 'cipolla', 'cebolla', 'oignon', 'garlic', 'knoblauch', 'aglio', 'ajo', 'wheat', 'weizen', 'frumento', 'trigo', 'blé', 'froment', 'inulin', 'inuline', 'inulina'],
          lactose: ['milk', 'milch', 'latte', 'leche', 'lait', 'cream', 'sahne', 'panna', 'crema', 'crème', 'nata', 'lactose', 'laktose', 'lattosio', 'lactosa'],
          fructose: ['honey', 'honig', 'miele', 'miel', 'agave'],
        };
        for (const [g, kws] of Object.entries(high)) {
          for (const kw of kws) if (ing.includes(kw)) { triggered.push(g); break; }
        }
        const risk = triggered.length === 0 ? 'low' : 'high';
        product = { name, brand: p.brands || '', ingredients: ingText || 'No data', risk, triggered: Array.from(new Set(triggered)), advice: risk === 'low' ? 'No high-FODMAP ingredients detected.' : `Contains ${Array.from(new Set(triggered)).join(', ')}.` };
      } else {
        product = { name: 'Product not found', brand: '', ingredients: 'Not in database', risk: 'low', triggered: [], advice: 'No data available.' };
      }
      setResult(product);
    } catch { setResult({ name: 'Network error', brand: '', ingredients: '', risk: 'low', triggered: [], advice: 'Could not connect.' }); }
    setLoading(false);
  };

  const reset = () => { setScanned(false); setResult(null); setLoading(false); setBarcodeWhen(new Date()); };
  const col = result ? CAT_COLORS[result.risk] : null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaViewSC style={{ flex: 1, backgroundColor: 'black' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')} style={s.modalCloseBtn}><XIcon size={24} color="#ffffff" /></TouchableOpacity>
          <Text style={{ color: 'white', fontSize: 17, fontWeight: '600' }}>{t ? t('barcode_title') : 'Scan barcode'}</Text>
        </View>
        {!result && !loading && (
          permission?.granted ? (
            <CameraView style={{ flex: 1 }} facing="back" onBarcodeScanned={handleBarcode} barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'qr'] }}>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 260, height: 160 }}>
                  {[{ top: 0, left: 0 }, { top: 0, right: 0 }, { bottom: 0, left: 0 }, { bottom: 0, right: 0 }].map((pos, i) => (
                    <View key={i} style={Object.assign({ position: 'absolute', width: 32, height: 32, borderColor: 'white', borderTopWidth: i < 2 ? 3 : 0, borderBottomWidth: i >= 2 ? 3 : 0, borderLeftWidth: i % 2 === 0 ? 3 : 0, borderRightWidth: i % 2 === 1 ? 3 : 0 }, pos)} />
                  ))}
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.8)', marginTop: 20 }}>{t ? t('barcode_point') : 'Point at a barcode'}</Text>
              </View>
            </CameraView>
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
              <Text style={{ color: 'white', fontSize: 18, marginBottom: 20 }}>{t ? t('barcode_cam_needed') : 'Camera permission needed'}</Text>
              <TouchableOpacity style={s.btnPrimary} onPress={requestPermission}><Text style={s.btnPrimaryText}>{t ? t('barcode_allow') : 'Allow'}</Text></TouchableOpacity>
            </View>
          )
        )}
        {loading && <ScanResultSkeleton label={t ? t('barcode_looking') : 'Looking up'} />}
        {result && col && (
          <ScrollView style={{ flex: 1, backgroundColor: '#fafbfa' }}>
            <View style={{ padding: 24 }}>
              <Text style={{ fontSize: 11, color: '#647264', fontWeight: '600' }}>{t ? t('barcode_found') : 'FOUND'}</Text>
              <Text style={{ fontSize: 22, fontWeight: '700', marginTop: 4 }}>{result.name}</Text>
              {result.brand ? <Text style={{ fontSize: 13, color: '#6b7a6b', marginTop: 4 }}>{result.brand}</Text> : null}
              <View style={{ marginTop: 16, padding: 20, borderRadius: 20, backgroundColor: col.dot }}>
                <Text style={{ color: 'white', fontSize: 11, fontWeight: '600' }}>{t ? t('barcode_risk') : 'FODMAP RISK'}</Text>
                <Text style={{ color: 'white', fontSize: 24, fontWeight: '700', marginTop: 4 }}>{result.risk === 'high' ? (t ? t('barcode_high') : 'High risk') : (t ? t('barcode_low') : 'Likely safe')}</Text>
                <Text style={{ color: 'white', fontSize: 13, marginTop: 8, lineHeight: 19 }}>{result.advice}</Text>
              </View>
              {result.ingredients && (
                <Surface elevation={1} primaryColor={THEME.primary} style={[s.cardFilled, { backgroundColor: THEME.card, marginHorizontal: 0, marginTop: 16 }]}>
                  <Text style={{ fontSize: 12, color: '#647264', fontWeight: '600', marginBottom: 8 }}>{t ? t('barcode_ingredients') : 'INGREDIENTS'}</Text>
                  <Text style={{ fontSize: 13, color: '#4a5a4a', lineHeight: 19 }}>{result.ingredients}</Text>
                </Surface>
              )}
              <View style={{ marginTop: 16 }}><DateTimeRow value={barcodeWhen} onChange={setBarcodeWhen} /></View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <TouchableOpacity style={[s.btnSecondary, { flex: 1 }]} onPress={reset}><Text style={s.btnSecondaryText}>{t ? t('barcode_scan_another') : 'Scan another'}</Text></TouchableOpacity>
                <TouchableOpacity style={[s.btnPrimary, { flex: 1, marginTop: 0 }]} onPress={() => onComplete(result, barcodeWhen)}><Text style={s.btnPrimaryText}>{t ? t('barcode_add') : 'Add to log'}</Text></TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        )}
      </SafeAreaViewSC>
    </Modal>
  );
}

function AIScanModal({ visible, onClose, onComplete, scansRemaining }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState('camera');
  // Reset to the camera whenever the modal closes, so reopening never shows the old result.
  useEffect(() => { if (!visible) setStage('camera'); }, [visible]);
  const capture = async () => { setStage('analyzing'); await new Promise(r => setTimeout(r, 2000)); setStage('result'); };
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaViewSC style={{ flex: 1, backgroundColor: 'black' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
          <TouchableOpacity onPress={() => { onClose(); setStage('camera'); }} accessibilityRole="button" accessibilityLabel={tG('close')} style={s.modalCloseBtn}><XIcon size={24} color="#ffffff" /></TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'white', fontSize: 17, fontWeight: '600' }}>AI scan meal</Text>
            {typeof scansRemaining === 'number' && <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>{scansRemaining} scans left this month</Text>}
          </View>
        </View>
        {stage === 'camera' && (permission?.granted ? (
          <CameraView style={{ flex: 1 }} facing="back">
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 40 }}>
              <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, marginBottom: 16, marginHorizontal: 30 }}>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 12, textAlign: 'center', lineHeight: 17 }}>
                  Beta: AI recognition is still in development. For now it gives a rough guess — always check the result.
                </Text>
              </View>
              <TouchableOpacity onPress={capture} accessibilityRole="button" accessibilityLabel={tG('a11y_take_photo')} style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#d4a040', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 26 }}>✨</Text></View>
              </TouchableOpacity>
            </View>
          </CameraView>
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
            <Text style={{ color: 'white', fontSize: 18, marginBottom: 20 }}>Camera permission needed</Text>
            <TouchableOpacity style={s.btnPrimary} onPress={requestPermission}><Text style={s.btnPrimaryText}>Allow</Text></TouchableOpacity>
          </View>
        ))}
        {stage === 'analyzing' && <ScanResultSkeleton label="Analyzing…" />}
        {stage === 'result' && (
          <ScrollView style={{ flex: 1, backgroundColor: '#fafbfa' }}>
            <View style={{ padding: 24 }}>
              <View style={{ backgroundColor: '#fffbf0', borderWidth: 1, borderColor: '#f0e0b0', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                <Text style={{ fontSize: 12, color: '#7a6a3a', lineHeight: 17 }}>
                  Beta feature — this is a rough estimate, not a verified identification. AI cannot see onion or garlic blended into a sauce. Always sanity-check before relying on it.
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: '#647264', fontWeight: '600' }}>BEST GUESS</Text>
              <Text style={{ fontSize: 22, fontWeight: '700', marginTop: 2 }}>Pasta with tomato sauce</Text>
              <View style={{ marginTop: 16, padding: 20, borderRadius: 20, backgroundColor: '#d4a040' }}>
                <Text style={{ color: 'white', fontSize: 11, fontWeight: '600' }}>ESTIMATED FODMAP</Text>
                <Text style={{ color: 'white', fontSize: 24, fontWeight: '700', marginTop: 4 }}>Moderate</Text>
                <Text style={{ color: 'white', fontSize: 13, marginTop: 8, lineHeight: 19 }}>Watch for hidden onion or garlic — the most common reason a pasta dish triggers symptoms.</Text>
              </View>
              <TouchableOpacity style={[s.btnPrimary, { marginTop: 16 }]} onPress={() => { onComplete(true); setStage('camera'); }}>
                <Text style={s.btnPrimaryText}>Log meal</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </SafeAreaViewSC>
    </Modal>
  );
}

function ScanLimitModal({ visible, onClose, allowance, t }) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 30 }}>
        <Surface accessibilityViewIsModal elevation={3} primaryColor={THEME.primary} style={{ backgroundColor: THEME.card, borderRadius: 20, padding: 24, width: '100%' }}>
          <Text style={{ fontSize: 40, textAlign: 'center' }}>✨</Text>
          <Text style={{ fontSize: 18, fontWeight: '700', textAlign: 'center', marginTop: 10 }}>{t('scan_limit_title')}</Text>
          <Text style={{ fontSize: 13, color: '#6b7a6b', textAlign: 'center', marginTop: 8, lineHeight: 19 }}>
            {t('scan_limit_body', { n: allowance })}
          </Text>
          <TouchableOpacity style={[s.btnPrimary, { marginTop: 18 }]} onPress={onClose}>
            <Text style={s.btnPrimaryText}>{t('gotIt')}</Text>
          </TouchableOpacity>
        </Surface>
      </View>
    </Modal>
  );
}

function MealModal({ visible, onClose, onSave, onBarcode, onAIScan, onAddCustomFood, profile, isPremium, scansRemaining, log, reintroProgress, lang, t }) {
  const [search, setSearch] = useState('');
  const [aiText, setAiText] = useState('');
  const [aiParsing, setAiParsing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [selected, setSelected] = useState([]);
  const [when, setWhen] = useState(new Date());
  const [mealType, setMealType] = useState(null); // null = follow the time-of-day default
  const effMealType = mealType || defaultMealType(when);
  // The food currently being portioned in the bottom-sheet overlay, or null when it's
  // closed. Kept separate from `selected` so the "Il tuo pasto" strip stays put while editing.
  const [editingId, setEditingId] = useState(null);
  const [introSheet, setIntroSheet] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false);
  const [introSeen, setIntroSeen] = useState(true);
  useEffect(() => { storageGet(STORAGE_KEYS.barcodeIntroSeen).then(v => setIntroSeen(!!v)); }, []);
  const openScanner = () => { onClose(); setTimeout(onBarcode, 300); };
  const handleScanPress = () => { if (introSeen) openScanner(); else setIntroSheet(true); };
  const confirmIntro = () => { setIntroSeen(true); storageSet(STORAGE_KEYS.barcodeIntroSeen, true); setIntroSheet(false); openScanner(); };
  // Real recents from the user's log, padded with a starter set for new users.
  const STARTER_FOODS = ['rice', 'chicken', 'tomato', 'pasta', 'onion', 'carrot', 'garlic', 'egg'];
  const recentIds = recentFoodIds(log, 8);
  const recent = [...recentIds, ...STARTER_FOODS.filter(id => !recentIds.includes(id))].slice(0, 8).map(id => FOODS.find(f => f.id === id)).filter(Boolean);
  // Distinct past meals for one-tap re-logging (only worth showing multi-food meals).
  const recentMealList = recentMeals(log, 6).filter(m => m.ids.length >= 2).slice(0, 4);
  const filtered = search.trim() ? FOODS.filter(f => {
    if (f.dishOnly) return false;   // combined dish-only meats (e.g. "Lamb or chicken") aren't searchable
    const q = search.trim().toLowerCase();
    // Match English name, the user's-language name, and any alias — same as the browse screen.
    return f.name.toLowerCase().includes(q) || foodName(f, lang).toLowerCase().includes(q) || (f.alias || '').toLowerCase().includes(q);
  }).slice(0, 8) : [];
  const toggle = (id) => setSelected(selected.find(x => x.foodId === id) ? selected.filter(x => x.foodId !== id) : selected.concat([makeMealItem(id)]));
  // Change one ingredient's portion size, updating its stored gram/unit value.
  const setItemSize = (foodId, size) => setSelected(selected.map(x => x.foodId === foodId ? Object.assign({}, x, { size, portionG: portionForItem(FOODS.find(f => f.id === foodId), size) }) : x));
  // Leave out / put back a single ingredient of a prepared dish (e.g. onion out of a
  // kebab). Kept as an `exclude` list on the dish item; resolveMeal drops those, so the
  // FODMAP verdict updates live. Always keeps at least one ingredient.
  const toggleExclude = (dishFoodId, ingId) => setSelected(selected.map(x => {
    if (x.foodId !== dishFoodId) return x;
    const recipe = DISH_INGREDIENTS[dishFoodId] || [];
    const ex = x.exclude || [];
    const isExcluded = ex.includes(ingId);
    if (!isExcluded && recipe.length - ex.length <= 1) return x; // keep at least one
    return Object.assign({}, x, { exclude: isExcluded ? ex.filter(i => i !== ingId) : ex.concat([ingId]) });
  }));
  // Add a food that isn't in the database, with a user-declared FODMAP level.
  const addCustom = (cat) => {
    const name = search.trim();
    if (!name) return;
    const now = new Date().toISOString();
    // Sync-ready shape: stable global id + timestamps + ownerId slot. ownerId stays null while
    // local; a future account/backend fills it on login and merges by updatedAt.
    const food = { id: uid('cf_'), name, emoji: '🍽️', cat, groups: [], lowT: null, modT: null, popTrigger: 0, group: 'custom', custom: true, createdAt: now, updatedAt: now, ownerId: null };
    onAddCustomFood(food);
    setSelected(selected.concat([makeMealItem(food.id)]));
    setSearch('');
  };
  const alreadyExact = search.trim() && FOODS.some(f => foodName(f, lang).toLowerCase() === search.trim().toLowerCase() || f.name.toLowerCase() === search.trim().toLowerCase());
  // Prepared dishes expand into their ingredients; normal foods pass through. The verdict
  // and save both use this resolved ingredient list, while the dish names label the meal.
  const resolved = resolveMeal(selected);
  const meal = resolved.items.length > 0 ? categorizeMeal(resolved.items, reintroProgress) : null;
  const col = meal ? CAT_COLORS[meal.overall] : null;
  // All foods pushing the meal to "high" — the reason lists every one of them, not just the first.
  const highFoods = meal ? meal.items.filter(v => v.verdictCat === 'high') : [];
  // Short reason for a Moderate/High verdict: the driving food(s), or stacking of moderates.
  const mealReason = (() => {
    if (!meal || meal.overall === 'low') return null;
    if (highFoods.length > 0) {
      const names = highFoods.slice(0, 2).map(v => foodName(v, lang));
      const extra = highFoods.length - names.length;
      return t('meal_reason_from', { food: names.join(', ') + (extra > 0 ? ' +' + extra : '') });
    }
    if (meal.stacking.length > 0) return t('meal_reason_stack');
    const mod = meal.items.find(v => v.verdictCat === 'mod');
    return mod ? t('meal_reason_from', { food: foodName(mod, lang) }) : null;
  })();
  // Swap tips: up to 2 high foods that have a curated low-FODMAP alternative.
  const swapTips = highFoods
    .map(v => { const sw = LOW_FODMAP_SWAPS[v.id]; return (sw && sw[0]) ? t('meal_swap_tip', { food: foodName(v, lang), alt: swapText(v.id, 0, sw[0], lang).name }) : null; })
    .filter(Boolean)
    .slice(0, 2);

  const runAIParse = async () => {
    if (!aiText.trim()) return;
    setAiParsing(true);
    setAiSuggestions(null);
    const result = await parseMealWithAI(aiText);
    setAiSuggestions(result);
    setAiParsing(false);
  };
  const acceptAISuggestions = () => {
    const newItems = aiSuggestions.map(f => makeMealItem(f.id));
    const merged = selected.slice();
    newItems.forEach(it => { if (!merged.find(x => x.foodId === it.foodId)) merged.push(it); });
    setSelected(merged);
    setAiSuggestions(null);
    setAiText('');
  };
  const reset = () => { setSelected([]); setSearch(''); setAiText(''); setAiSuggestions(null); setWhen(new Date()); setMealType(null); setEditingId(null); };
  // Closing the builder (✕ or hardware back) throws the meal away — so confirm first when
  // there's anything selected. An empty builder just closes, no prompt.
  const attemptClose = () => {
    if (selected.length > 0) setDiscardConfirm(true);
    else { onClose(); reset(); }
  };
  const confirmDiscard = () => { setDiscardConfirm(false); onClose(); reset(); };

  // While searching, show matches only (don't fall back to recents — that hid the fact that
  // nothing matched). Recents show when the search box is empty.
  const list = search.trim() ? filtered : recent;
  const xWarn = mealCrossWarnings(selected, profile);
  const hasBase = selected.some(it => { const f = FOODS.find(x => x.id === it.foodId); return f && f.base; });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={attemptClose}>
      <SafeAreaViewSC style={{ flex: 1, backgroundColor: THEME.bg }}>
        <AppBar title={t('meal_modal_title')} onBack={attemptClose} backIcon="close" t={t} />
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
            <DateTimeRow value={when} onChange={setWhen} />
            {/* Meal-of-day tag — auto-set from the time, tap to change */}
            <Text style={{ fontSize: 13, color: '#3d4d3d', fontWeight: '600', marginTop: 14, marginBottom: 10 }}>{tG('meal_select_type')}</Text>
            <MealTypeSelector value={effMealType} onChange={setMealType} t={t} style={{ marginBottom: 14 }} />
          </View>

          {/* Search — the primary way to add foods */}
          <View style={{ marginHorizontal: 16, marginBottom: 10, backgroundColor: '#e6ede6', borderRadius: 28, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 52 }}>
            <SearchIcon size={20} />
            <TextInput accessibilityLabel={t('meal_modal_search_ph')} value={search} onChangeText={setSearch} placeholder={t('meal_modal_search_ph')} placeholderTextColor="#6b7a6b" style={{ flex: 1, paddingVertical: 13, fontSize: 16, marginLeft: 10 }} />
            {search
              ? <TouchableOpacity onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel={t('a11y_clear')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.6} style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#16210f', alignItems: 'center', justifyContent: 'center', marginLeft: 4 }}><XIcon size={13} color="#ffffff" /></TouchableOpacity>
              : <TouchableOpacity onPress={handleScanPress} accessibilityRole="button" accessibilityLabel={t('barcode_title')} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.6} style={{ paddingLeft: 8, paddingVertical: 4 }}><BarcodeIcon size={24} color={THEME.primaryDark} /></TouchableOpacity>}
          </View>

          {/* Recent meals — one-tap re-log of a past meal */}
          {selected.length === 0 && !search.trim() && recentMealList.length > 0 && (
            <View style={{ marginBottom: 6 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: THEME.textSoft, marginBottom: 4, paddingHorizontal: 16 }}>{t('meal_modal_recent_meals')}</Text>
              {/* paddingTop/Bottom give the card shadow room so the ScrollView doesn't clip it */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 }}>
                {recentMealList.map((m, i) => {
                  const foods = m.ids.map(id => FOODS.find(f => f.id === id)).filter(Boolean);
                  const names = foods.map(f => foodName(f, lang)).join(', ');
                  return (
                    <TouchableOpacity key={i} onPress={() => setSelected(m.ids.map(id => makeMealItem(id)))} accessibilityRole="button" accessibilityLabel={names}>
                      <Surface elevation={1} tinted={false} style={{ backgroundColor: THEME.card, borderRadius: THEME.rCard, paddingHorizontal: 12, paddingVertical: 10, maxWidth: 180, borderWidth: 1, borderColor: THEME.cardBorder }}>
                        <Text importantForAccessibility="no" style={{ fontSize: 17 }}>{foods.slice(0, 4).map(f => f.emoji).join(' ')}</Text>
                        <Text importantForAccessibility="no" numberOfLines={1} style={{ fontSize: 12, color: THEME.ink, marginTop: 3, maxWidth: 156 }}>{names}</Text>
                      </Surface>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* "Your meal" now lives in the sticky bottom bar (always visible + removable),
              so it no longer scrolls away under the search box. See the bottom section below. */}

          {/* Histamine alert */}
          {xWarn && (
            <View style={{ marginHorizontal: 16, padding: 16, borderRadius: 16, backgroundColor: '#fff4f0', borderWidth: 1, borderColor: '#f0d0c0', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Text style={{ fontSize: 18 }}>🌡️</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#a04030' }}>{t('meal_modal_hist_alert')}</Text>
              </View>
              {xWarn.highHist.length > 0 && <Text style={{ fontSize: 13, color: '#6b4030', lineHeight: 19, marginBottom: 4 }}>{t('meal_modal_high_hist', { foods: xWarn.highHist.join(', ') })}</Text>}
              {xWarn.liberators.length > 0 && <Text style={{ fontSize: 13, color: '#6b4030', lineHeight: 19 }}>{t('meal_modal_hist_lib', { foods: xWarn.liberators.join(', ') })}</Text>}
              <Text style={{ fontSize: 11, color: '#8a6a5a', marginTop: 6, fontStyle: 'italic' }}>{t('meal_modal_hist_note')}</Text>
            </View>
          )}

          {/* Food rows */}
          {list.length > 0 && (
          <View style={{ paddingHorizontal: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: THEME.textSoft, marginBottom: 4 }}>{search.trim() ? t('meal_modal_results') : t('meal_modal_recent')}</Text>
            {list.map(f => {
              const isSel = !!selected.find(x => x.foodId === f.id);
              // Once selected, show the food's verdict at its chosen per-ingredient portion,
              // not its raw category — a moderate food can be low in a small portion.
              const rowCat = isSel ? (meal?.items.find(v => v.id === f.id)?.verdictCat || f.cat) : f.cat;
              return (
                <TouchableOpacity key={f.id} onPress={() => { if (!isSel) setSelected(selected.concat([makeMealItem(f.id)])); setEditingId(f.id); setSearch(''); }} accessibilityRole="button" accessibilityState={{ checked: isSel }} accessibilityLabel={foodName(f, lang)} accessibilityHint={t('meal_edit_portion_of', { food: foodName(f, lang) })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#f1f4f1' }}>
                  <Text importantForAccessibility="no" style={{ fontSize: 22 }}>{f.emoji}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 14, fontWeight: '500', color: THEME.ink }}>{foodName(f, lang)}</Text>
                    {/* Base dishes list their ingredients so they're clearly distinct from a plain
                        single ingredient (e.g. "Pizza Margherita (plain)" vs "Pizza dough"). */}
                    {DISH_INGREDIENTS[f.id] && (
                      <Text importantForAccessibility="no" style={{ fontSize: 11, color: THEME.textMuted, marginTop: 1 }} numberOfLines={1}>{t('meal_dish_contains')}: {dishIngredientNames(f.id, lang).join(', ')}</Text>
                    )}
                  </View>
                  <RiskPill cat={rowCat} t={t} />
                  <View importantForAccessibility="no" style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, borderColor: isSel ? '#4e7d4e' : '#c4cec4', backgroundColor: isSel ? '#4e7d4e' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {isSel ? <CheckIcon color="#fff" size={13} /> : <Text style={{ color: '#3d4d3d', fontSize: 17, fontWeight: '700', lineHeight: 19 }}>+</Text>}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          )}

          {/* Add a custom food not in the database, with a self-declared FODMAP level */}
          {search.trim().length > 0 && !alreadyExact && (
            <Surface elevation={1} primaryColor={THEME.primary} style={{ marginHorizontal: 16, marginTop: 14, backgroundColor: THEME.card, borderRadius: THEME.rCard, padding: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: THEME.ink }}>{t('meal_custom_q', { name: search.trim() })}</Text>
              {/* Prominent tip about single ingredients */}
              <View style={{ backgroundColor: '#f5faf5', borderRadius: 12, padding: 12, marginVertical: 12, borderLeftWidth: 4, borderLeftColor: '#4e7d4e', flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                <BulbIcon size={16} color="#2d6a2d" />
                <Text style={{ flex: 1, fontSize: 12, color: '#2d6a2d', fontWeight: '600', lineHeight: 18 }}>{t('meal_custom_tip')}</Text>
              </View>
              <Text style={{ fontSize: 13, color: '#5e7060', marginBottom: 12, lineHeight: 18 }}>{t('meal_custom_add')}</Text>
              {/* Three buttons with descriptions */}
              <View style={{ gap: 10 }}>
                {[{ id: 'low', desc: t('meal_custom_low_desc') }, { id: 'mod', desc: t('meal_custom_mod_desc') }, { id: 'high', desc: t('meal_custom_high_desc') }].map(item => (
                  <TouchableOpacity key={item.id} onPress={() => addCustom(item.id)} accessibilityRole="button" accessibilityLabel={`${search.trim()}: ${item.id === 'low' ? t('meal_low') : item.id === 'high' ? t('meal_high') : t('meal_moderate')}`} style={{ borderWidth: 1.5, borderColor: '#c4cec4', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'flex-start' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' }}>
                      <RiskPill cat={item.id} t={t} />
                      <Text style={{ fontSize: 12, color: '#6b7a6b', flex: 1, lineHeight: 16 }}>{item.desc}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </Surface>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Sticky bottom — your meal (tap a chip to edit its portion, ✕ to remove) + live
            verdict + save. Kept here so the meal is always visible while you search/add. */}
        <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, borderTopWidth: 1, borderTopColor: THEME.cardBorder, backgroundColor: 'white', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: -4 }, elevation: 16 }}>
          {selected.length > 0 && (
            <>
              {/* Personalised meal-of-day name — labels what you're about to save */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: THEME.ink, marginBottom: 8 }}>{t('meal_my_' + effMealType)}</Text>
              {hasBase && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#f0f6ef', borderRadius: 12, padding: 10, marginBottom: 10 }}>
                  <BulbIcon size={16} color={THEME.primaryDark} />
                  <Text style={{ flex: 1, fontSize: 12, color: '#3d4d3d', lineHeight: 17 }}>{t('meal_base_hint')}</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 10 }}>
                {selected.map(it => {
                  const f = FOODS.find(x => x.id === it.foodId);
                  if (!f) return null;
                  const sizeLabel = t('edit_portion_' + (it.size || 'M').toLowerCase());
                  return (
                    <View key={it.foodId} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e8f0e8', borderRadius: 14, paddingLeft: 10, paddingRight: 5, paddingVertical: 6 }}>
                      <TouchableOpacity onPress={() => setEditingId(it.foodId)} accessibilityRole="button" accessibilityLabel={`${foodName(f, lang)}, ${sizeLabel}`} accessibilityHint={t('meal_edit_portion_of', { food: foodName(f, lang) })} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text importantForAccessibility="no" style={{ fontSize: 14 }}>{f.emoji}</Text>
                        <Text importantForAccessibility="no" style={{ fontSize: 13, color: '#2d6a2d', fontWeight: '500' }}>{foodName(f, lang)}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => toggle(it.foodId)} accessibilityRole="button" accessibilityLabel={`${t('meal_remove_item')} · ${foodName(f, lang)}`} hitSlop={{ top: 8, bottom: 8, left: 2, right: 8 }} style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#cfe3cf', alignItems: 'center', justifyContent: 'center' }}>
                        <XIcon size={11} color="#2d6a2d" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              {selected.length > 0 && meal ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: col.dot }} />
                    <Text style={{ fontSize: 14, fontWeight: '700', color: col.text }}>{meal.overall === 'low' ? t('meal_low') : meal.overall === 'high' ? t('meal_high') : t('meal_moderate')}</Text>
                    {mealReason && <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: '#647264' }}>· {mealReason}</Text>}
                  </View>
                  {swapTips.map((tip, i) => (
                    <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                      <BulbIcon size={14} color="#4e7d4e" />
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 11.5, color: '#4e7d4e', fontWeight: '600' }}>{tip}</Text>
                    </View>
                  ))}
                </>
              ) : (
                <Text style={{ fontSize: 13, color: '#647264' }}>{t('meal_modal_pick')}</Text>
              )}
            </View>
            <TouchableOpacity onPress={() => { onSave(resolved.items, when, effMealType, resolved.dishes); reset(); }} disabled={selected.length === 0} style={{ backgroundColor: selected.length ? '#4e7d4e' : '#c0d0c0', borderRadius: 14, paddingHorizontal: 26, paddingVertical: 13 }}>
              <Text style={{ color: 'white', fontSize: 15, fontWeight: '700' }}>{t('save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaViewSC>

      {/* Portion editor — a bottom-sheet overlay that floats ON TOP of the meal screen so
          the "Il tuo pasto" strip stays visible behind it. Opened by tapping a chip or a
          search/recent result. Confirm/dismiss collapses it; the strip's badge updates. */}
      {(() => {
        const it = selected.find(x => x.foodId === editingId);
        const f = it && FOODS.find(x => x.id === editingId);
        return (
          <BottomSheet visible={!!(it && f)} onClose={() => setEditingId(null)}>
              {it && f && (
                <View accessibilityViewIsModal style={{ backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28 }}>
                  <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#d6ddd6', marginBottom: 18 }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#e8f0e8', alignItems: 'center', justifyContent: 'center' }}>
                      <Text importantForAccessibility="no" style={{ fontSize: 24 }}>{f.emoji}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ fontSize: 12, color: THEME.textMuted, fontWeight: '600' }} numberOfLines={1}>{t('edit_portion')}</Text>
                      <Text style={{ fontSize: 18, fontWeight: '700', color: THEME.ink }} numberOfLines={1}>{foodName(f, lang)}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setEditingId(null)} accessibilityRole="button" accessibilityLabel={t('close')} style={s.modalCloseBtn}><XIcon size={24} color={THEME.ink} /></TouchableOpacity>
                  </View>
                  {/* Full dish: show ingredients big with emoji, and let the user leave any out
                      (e.g. onion out of a kebab). Tapping toggles it; resolveMeal drops excluded
                      ones so the FODMAP verdict updates live. */}
                  {DISH_INGREDIENTS[f.id] && (
                    <View style={{ backgroundColor: '#f0f6ef', borderRadius: 14, padding: 12, marginBottom: 18 }}>
                      <Text style={{ fontSize: 12, color: THEME.textMuted, fontWeight: '600' }}>{t('meal_dish_contains')}</Text>
                      <Text style={{ fontSize: 11, color: THEME.textMuted, marginTop: 2, marginBottom: 10 }}>{t('meal_dish_remove_hint')}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {DISH_INGREDIENTS[f.id].map(([iid]) => {
                          const ing = FOODS.find(x => x.id === iid);
                          if (!ing) return null;
                          const excluded = (it.exclude || []).includes(iid);
                          return (
                            <TouchableOpacity key={iid} onPress={() => toggleExclude(f.id, iid)} accessibilityRole="button" accessibilityState={{ selected: !excluded }} accessibilityLabel={`${foodName(ing, lang)}${excluded ? ', ' + t('meal_ingredient_removed') : ''}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: excluded ? 'transparent' : 'white', borderWidth: 1, borderStyle: 'dashed', borderColor: excluded ? '#b7c2b7' : 'transparent', borderRadius: 12, paddingLeft: 9, paddingRight: 10, paddingVertical: 7, opacity: excluded ? 0.6 : 1 }}>
                              <Text importantForAccessibility="no" style={{ fontSize: 22 }}>{ing.emoji}</Text>
                              <Text style={{ fontSize: 15, color: THEME.ink, fontWeight: '600', textDecorationLine: excluded ? 'line-through' : 'none' }}>{foodName(ing, lang)}</Text>
                              {excluded ? <IconPlus size={15} color="#647264" /> : <XIcon size={14} color="#4e7d4e" />}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {/* Nudge: dishes are a base recipe — extras (sauces, dips, grilled veg…)
                          are added as separate foods from the meal screen's search. */}
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#dceadc' }}>
                        <BulbIcon size={14} color={THEME.primaryDark} />
                        <Text style={{ flex: 1, fontSize: 11.5, color: '#3d4d3d', lineHeight: 16 }}>{t('meal_dish_add_hint')}</Text>
                      </View>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                    {[{ id: 'S', label: t('edit_portion_s') }, { id: 'M', label: t('edit_portion_m') }, { id: 'L', label: t('edit_portion_l') }].map(p => {
                      const on = it.size === p.id;
                      return (
                        <TouchableOpacity key={p.id} onPress={() => setItemSize(f.id, p.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${p.label}, ${itemSizeLabel(f, p.id, t, lang)}`} style={{ flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: on ? '#4e7d4e' : '#c4cec4', backgroundColor: on ? '#dcebdc' : 'transparent', alignItems: 'center' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            {on && <CheckIcon color="#2d6a2d" size={13} />}
                            <Text style={{ fontSize: 14, fontWeight: '700', color: on ? '#2d6a2d' : '#2d3a2d' }}>{p.label}</Text>
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: '600', marginTop: 3, color: on ? '#2d6a2d' : '#3d4d3d' }}>{itemSizeLabel(f, p.id, t, lang)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <TouchableOpacity onPress={() => setEditingId(null)} style={[s.btnPrimary, { marginTop: 0 }]}>
                    <Text style={s.btnPrimaryText}>{t('done')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { toggle(f.id); setEditingId(null); }} accessibilityRole="button" style={{ paddingVertical: 14, alignItems: 'center', marginTop: 4 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#a03030' }}>{t('meal_remove_item')}</Text>
                  </TouchableOpacity>
                </View>
              )}
          </BottomSheet>
        );
      })()}

      {/* First-run explainer for barcode scanning */}
      <BottomSheet visible={introSheet} onClose={() => setIntroSheet(false)}>
          <View accessibilityViewIsModal style={{ backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 32 }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Flora size={96} mood="good" />
                <View style={{ position: 'absolute', bottom: -4, right: -8, backgroundColor: '#e8f0e8', borderRadius: 16, padding: 8, borderWidth: 2, borderColor: 'white' }}>
                  <BarcodeIcon size={26} color={THEME.primaryDark} />
                </View>
              </View>
            </View>
            <Text style={{ fontSize: 22, fontWeight: '700', color: THEME.ink, textAlign: 'center', marginBottom: 8 }}>{t('barcode_intro_title')}</Text>
            <Text style={{ fontSize: 14, color: THEME.textSoft, textAlign: 'center', lineHeight: 21, marginBottom: 22 }}>{t('barcode_intro_body')}</Text>
            <TouchableOpacity onPress={confirmIntro} style={[s.btnPrimary, { marginTop: 0 }]}>
              <Text style={s.btnPrimaryText}>{t('barcode_intro_cta')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIntroSheet(false)} style={{ paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, color: THEME.textMuted, fontWeight: '600' }}>{t('barcode_intro_later')}</Text>
            </TouchableOpacity>
          </View>
      </BottomSheet>

      {/* Discard-meal confirmation — replaces the native Alert.alert so the primary action
          uses the app's own green rather than the OS system tint (blue on iOS). */}
      <BottomSheet visible={discardConfirm} onClose={() => setDiscardConfirm(false)}>
          <View accessibilityViewIsModal style={{ backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 22, paddingBottom: 32 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: THEME.ink, textAlign: 'center' }}>{t('meal_discard_title')}</Text>
            <Text style={{ fontSize: 14, color: THEME.textSoft, textAlign: 'center', lineHeight: 20, marginTop: 8 }}>{t('meal_discard_body')}</Text>
            <TouchableOpacity onPress={() => setDiscardConfirm(false)} style={[s.btnPrimary, { marginTop: 20 }]}>
              <Text style={s.btnPrimaryText}>{t('meal_discard_keep')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmDiscard} accessibilityRole="button" style={{ paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#a03030' }}>{t('meal_discard_confirm')}</Text>
            </TouchableOpacity>
          </View>
      </BottomSheet>
    </Modal>
  );
}

function FoodChip({ food, selected, onPress }) {
  const dot = CAT_COLORS[food.cat].dot;
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: !!selected }} accessibilityLabel={food.name} style={{ backgroundColor: selected ? '#e8f0e8' : 'white', borderWidth: 1.5, borderColor: selected ? '#7caa7c' : '#c4cec4', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <View importantForAccessibility="no" style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
      <Text importantForAccessibility="no" style={{ fontSize: 14 }}>{food.emoji}</Text>
      <Text style={{ fontSize: 13 }}>{food.name}</Text>
      {selected && <View importantForAccessibility="no"><CheckIcon color="#4e7d4e" size={12} /></View>}
    </TouchableOpacity>
  );
}

function SymptomModal({ visible, onClose, onSave, t }) {
  const [symptom, setSymptom] = useState(null);
  const [intensity, setIntensity] = useState(3);
  const [when, setWhen] = useState(new Date());
  const symptoms = [
    { id: 'Bloating', key: 'symptom_bloating', icon: '🎈' },
    { id: 'Pain', key: 'symptom_pain', icon: '⚡' },
    { id: 'Gas', key: 'symptom_gas', icon: '💨' },
    { id: 'Diarrhea', key: 'symptom_diarrhea', icon: '🌊' },
    { id: 'Constipation', key: 'symptom_constipation', icon: '🧱' },
    { id: 'Nausea', key: 'symptom_nausea', icon: '🤢' },
  ];
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaViewSC style={{ flex: 1, backgroundColor: '#fafbfa' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f4f0' }}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')} style={s.modalCloseBtn}><XIcon size={24} color={THEME.ink} /></TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '700' }}>{t('symptom_title')}</Text>
        </View>
        <ScrollView style={{ flex: 1 }}>
          <View style={{ padding: 20 }}>
            <DateTimeRow value={when} onChange={setWhen} />
            <Text style={{ fontSize: 13, color: '#6b7a6b', marginBottom: 12 }}>{t('symptom_q')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {symptoms.map(sy => (
                <TouchableOpacity key={sy.id} onPress={() => setSymptom(sy.id)} accessibilityRole="radio" accessibilityState={{ selected: symptom === sy.id }} accessibilityLabel={t(sy.key)} style={{ width: (width - 60) / 3, backgroundColor: symptom === sy.id ? '#fde0e0' : 'white', borderWidth: 1.5, borderColor: symptom === sy.id ? '#c85050' : '#c4cec4', borderRadius: 14, padding: 16, alignItems: 'center', gap: 6 }}>
                  <Text importantForAccessibility="no" style={{ fontSize: 24 }}>{sy.icon}</Text>
                  <Text style={{ fontSize: 12, fontWeight: '500' }}>{t(sy.key)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {symptom && (
              <>
                <Text style={{ fontSize: 13, color: '#6b7a6b', marginTop: 20, marginBottom: 12 }}>{t('symptom_intensity', { n: intensity })}</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <TouchableOpacity key={n} onPress={() => setIntensity(n)} accessibilityRole="radio" accessibilityState={{ selected: intensity === n }} accessibilityLabel={t('symptom_intensity', { n })} style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: n <= intensity ? `hsl(${15 - (n - 1) * 3}, 60%, ${65 - (n - 1) * 5}%)` : '#f0f4f0', alignItems: 'center' }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: n <= intensity ? 'white' : '#647264' }}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <TouchableOpacity onPress={() => { onSave(symptom, intensity, when); setSymptom(null); setIntensity(3); setWhen(new Date()); }} disabled={!symptom} style={[s.btnPrimary, { opacity: symptom ? 1 : 0.5 }]}>
              <Text style={s.btnPrimaryText}>{t('symptom_log_btn')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaViewSC>
    </Modal>
  );
}

function PaywallModal({ visible, onClose, onUpgrade, reason, t }) {
  const [plan, setPlan] = useState('annual');
  // Contextual headline based on what the user just tried to do
  const headlines = {
    reintro: t('paywall_headline_reintro'),
    recipes: t('paywall_headline_recipes'),
    history: t('paywall_headline_history'),
    export: t('paywall_headline_export'),
    scan: t('paywall_headline_scan'),
  };
  const subs = {
    reintro: t('paywall_sub_reintro'),
    recipes: t('paywall_sub_recipes'),
    history: t('paywall_sub_history'),
    export: t('paywall_sub_export'),
    scan: t('paywall_sub_scan'),
  };
  const headline = headlines[reason] || t('paywall_headline_default');
  const sub = subs[reason] || t('paywall_sub_default');

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaViewSC style={{ flex: 1, backgroundColor: '#fafbfa' }}>
        <View style={{ alignItems: 'flex-end', padding: 16 }}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ width: 36, height: 36, backgroundColor: '#f0f4f0', borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}><XIcon size={24} color={THEME.ink} /></TouchableOpacity>
        </View>
        <ScrollView>
          <View style={{ alignItems: 'center', paddingHorizontal: 24 }}>
            <PremiumHero />
            <Text style={{ fontSize: 23, fontWeight: '700', marginTop: 4, textAlign: 'center' }}>{headline}</Text>
            <Text style={{ fontSize: 14, color: '#6b7a6b', marginTop: 8, textAlign: 'center', lineHeight: 20 }}>{sub}</Text>
          </View>

          <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#647264', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('paywall_includes')}</Text>
            {[
              { icon: '🧪', label: t('paywall_feat_reintro'), sub: t('paywall_feat_reintro_sub') },
              { icon: '📖', label: t('paywall_feat_recipes'), sub: t('paywall_feat_recipes_sub') },
              { icon: '🗺️', label: t('paywall_feat_scan'), sub: t('paywall_feat_scan_sub') },
              { icon: '🔍', label: t('paywall_feat_history'), sub: t('paywall_feat_history_sub') },
              { icon: '📄', label: t('paywall_feat_export'), sub: t('paywall_feat_export_sub') },
            ].map((f, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <Text style={{ fontSize: 22 }}>{f.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600' }}>{f.label}</Text>
                  <Text style={{ fontSize: 12, color: '#647264', marginTop: 1 }}>{f.sub}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={{ paddingHorizontal: 24, marginTop: 12 }}>
            <View style={{ backgroundColor: '#e8f0e8', borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <Text style={{ fontSize: 12, color: '#2d6a2d', lineHeight: 17 }}>
                {t('paywall_free_note')}
              </Text>
            </View>

            <TouchableOpacity onPress={() => setPlan('annual')} accessibilityRole="radio" accessibilityState={{ selected: plan === 'annual' }} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 2, borderColor: plan === 'annual' ? '#4e7d4e' : '#c4cec4', backgroundColor: plan === 'annual' ? '#f5faf5' : 'white', marginBottom: 8 }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: plan === 'annual' ? '#4e7d4e' : '#c0d0c0', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                {plan === 'annual' && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#4e7d4e' }} />}
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 15, fontWeight: '700' }}>{t('annual')}</Text>
                  <View style={{ backgroundColor: '#4e7d4e', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}><Text style={{ fontSize: 9, color: 'white', fontWeight: '700' }}>{t('paywall_best_badge')}</Text></View>
                </View>
                <Text style={{ fontSize: 12, color: '#6b7a6b', marginTop: 2 }}>{t('paywall_annual_price')}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setPlan('monthly')} accessibilityRole="radio" accessibilityState={{ selected: plan === 'monthly' }} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 2, borderColor: plan === 'monthly' ? '#4e7d4e' : '#c4cec4', backgroundColor: plan === 'monthly' ? '#f5faf5' : 'white' }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: plan === 'monthly' ? '#4e7d4e' : '#c0d0c0', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                {plan === 'monthly' && <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#4e7d4e' }} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '700' }}>{t('monthly')}</Text>
                <Text style={{ fontSize: 12, color: '#6b7a6b', marginTop: 2 }}>{t('paywall_monthly_price')}</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[s.btnPrimary, { width: '100%', marginTop: 20 }]} onPress={onUpgrade}>
              <Text style={s.btnPrimaryText}>{t('paywall_trial_btn')}</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 11, color: '#647264', marginTop: 10, textAlign: 'center', lineHeight: 16 }}>
              {t('paywall_trial_note', { price: plan === 'annual' ? t('paywall_annual_price') : t('paywall_monthly_price') })}
            </Text>
            <View style={{ height: 30 }} />
          </View>
        </ScrollView>
      </SafeAreaViewSC>
    </Modal>
  );
}

// Turn a Supabase auth error into a short, localized, user-safe message — never
// dump a raw error object or HTTP response into the UI.
function friendlyAuthError(err, t) {
  if (!err) return t('auth_err_generic');
  const msg = typeof err.message === 'string' ? err.message : '';
  const status = err.status || 0;
  const code = err.code || '';
  if (/invalid login credentials/i.test(msg)) return t('auth_err_credentials');
  if (/already registered|already been registered|user already exists/i.test(msg)) return t('auth_err_exists');
  if (/not confirmed|confirm your email/i.test(msg)) return t('auth_err_unconfirmed');
  if (status >= 500 || code === 'unexpected_failure' || /sending.*email|smtp|confirmation email/i.test(msg)) return t('auth_err_send');
  if (msg && msg.length < 120) return msg; // a short, clean API message is fine to show as-is
  return t('auth_err_generic');
}

// Full-screen confirmation shown after a successful sign-up: Flora springs in
// (on top of her own breathe/blink) and we tell the user to check their inbox.
function AuthSentScreen({ email, variant = 'signup', onBackToLogin, onClose, t }) {
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, friction: 6, tension: 55, useNativeDriver: true }).start();
  }, []);
  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const textY = enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const body = variant === 'reset' ? t('auth_reset_sent_body', { email }) : t('auth_sent_body', { email });
  return (
    <View style={{ flex: 1 }}>
      <View style={{ alignItems: 'flex-end', padding: 16 }}>
        <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')} style={s.modalCloseBtn}><XIcon size={24} color={THEME.ink} /></TouchableOpacity>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, marginTop: -40 }}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <BlinkingFlora size={150} mood="good" />
        </Animated.View>
        <Animated.View style={{ opacity: enter, transform: [{ translateY: textY }], alignItems: 'center' }}>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#26302a', marginTop: 24, textAlign: 'center' }}>{t('auth_sent_title')}</Text>
          <Text style={{ fontSize: 15, color: '#5b6a5b', marginTop: 12, textAlign: 'center', lineHeight: 22 }}>{body}</Text>
        </Animated.View>
      </View>
      <View style={{ padding: 20 }}>
        <TouchableOpacity onPress={onBackToLogin} accessibilityRole="button" style={[s.btnPrimary, { alignSelf: 'stretch' }]}>
          <Text style={s.btnPrimaryText}>{t('auth_back_to_login')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Account screen: sign in, create an account, or request a password reset.
// The app works fully signed-out; this only layers an account on top. Sign-in
// success is handled by the App's onAuthStateChange listener (toast + ownerId
// backfill), so on success we simply close.
function AuthModal({ visible, onClose, initialMode, user, onSignOut, t }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');   // signup: confirm-password field
  const [showPw, setShowPw] = useState(false);  // eye toggle for password fields
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(''); // success message (reset sent)
  const [sentEmail, setSentEmail] = useState(''); // set after signup/reset → shows full-screen "check your email"
  const [sentVariant, setSentVariant] = useState('signup'); // 'signup' | 'reset' → which message to show

  // Reset transient state whenever the modal is opened or closed. On open, honor
  // the requested starting mode (e.g. nudges open straight on "Create account").
  useEffect(() => {
    if (visible) { setMode(initialMode || 'login'); }
    else { setMode('login'); setEmail(''); setPassword(''); setConfirm(''); setShowPw(false); setError(''); setNotice(''); setSentEmail(''); setBusy(false); }
  }, [visible]);
  useEffect(() => { setError(''); setNotice(''); setConfirm(''); setShowPw(false); setSentEmail(''); }, [mode]);

  // If the user signs in successfully, the App listener fires and we close.
  useEffect(() => { if (visible && user) onClose(); }, [user, visible]);

  const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const submit = async () => {
    const em = email.trim();
    setError(''); setNotice('');
    if (!emailOk(em)) { setError(t('auth_err_email')); return; }
    if (mode !== 'reset') {
      if (!password) { setError(t('auth_err_empty')); return; }
      if (password.length < 6) { setError(t('auth_err_password_short')); return; }
    }
    if (mode === 'signup' && password !== confirm) { setError(t('auth_err_mismatch')); return; }
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email: em, password });
        if (err) { setError(friendlyAuthError(err, t)); return; }
        // success → App listener closes the modal
      } else if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({ email: em, password });
        if (err) { setError(friendlyAuthError(err, t)); return; }
        setSentVariant('signup'); setSentEmail(em); // show the full-screen confirmation with Flora
      } else {
        // reset: always succeed-looking so we don't reveal which emails exist
        await supabase.auth.resetPasswordForEmail(em);
        setSentVariant('reset'); setSentEmail(em);
      }
    } catch (e) {
      setError(friendlyAuthError(e, t));
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'signup' ? t('auth_title_signup') : mode === 'reset' ? t('auth_title_reset') : t('auth_title_login');
  const subtitle = mode === 'signup' ? t('auth_sub_signup') : mode === 'reset' ? t('auth_sub_reset') : t('auth_sub_login');
  const cta = mode === 'signup' ? t('sign_up') : mode === 'reset' ? t('auth_send_reset') : t('sign_in');
  const inputStyle = { backgroundColor: '#f0f4f0', borderRadius: 12, padding: 14, fontSize: 16, marginTop: 6 };

  // A password input with a show/hide eye button. Called as a function (not a
  // <Component/>) so the TextInput keeps focus across renders instead of remounting.
  const pwField = ({ label, value, onChange, ph, tc, onSubmit, returnKey }) => (
    <View style={{ marginTop: 16 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#3d4a3d' }}>{label}</Text>
      <View style={{ position: 'relative', marginTop: 6 }}>
        <TextInput
          value={value} onChangeText={onChange}
          accessibilityLabel={label} placeholder={ph} placeholderTextColor="#9aa89a"
          autoCapitalize="none" autoCorrect={false} secureTextEntry={!showPw}
          textContentType={tc} editable={!busy} onSubmitEditing={onSubmit} returnKeyType={returnKey}
          style={[inputStyle, { marginTop: 0, paddingRight: 48 }]}
        />
        <TouchableOpacity
          onPress={() => setShowPw(v => !v)} accessibilityRole="button"
          accessibilityLabel={showPw ? t('auth_hide_password') : t('auth_show_password')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ position: 'absolute', right: 12, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
        >
          <EyeIcon off={showPw} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaViewSC style={{ flex: 1, backgroundColor: '#fafbfa' }}>
        {sentEmail ? (
          <AuthSentScreen email={sentEmail} variant={sentVariant} onClose={onClose} onBackToLogin={() => { setSentEmail(''); setMode('login'); }} t={t} />
        ) : (
        <>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f4f0' }}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')} style={s.modalCloseBtn}><XIcon size={24} color={THEME.ink} /></TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '700' }}>{t('account')}</Text>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
            <View style={{ alignItems: 'center', marginTop: 8 }}><BlinkingFlora size={76} mood="good" /></View>
            <Text style={{ fontSize: 22, fontWeight: '700', textAlign: 'center', marginTop: 8 }}>{title}</Text>
            <Text style={{ fontSize: 14, color: '#6b7a6b', textAlign: 'center', marginTop: 6, lineHeight: 20 }}>{subtitle}</Text>

            <View style={{ marginTop: 24 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#3d4a3d' }}>{t('auth_email')}</Text>
              <TextInput
                value={email} onChangeText={setEmail}
                accessibilityLabel={t('auth_email')} placeholder={t('auth_email_ph')} placeholderTextColor="#9aa89a"
                autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress"
                editable={!busy} style={inputStyle}
              />
            </View>

            {mode !== 'reset' && pwField({
              label: t('auth_password'), value: password, onChange: setPassword,
              ph: t('auth_password_ph'), tc: mode === 'signup' ? 'newPassword' : 'password',
              onSubmit: mode === 'signup' ? undefined : submit, returnKey: mode === 'signup' ? 'next' : 'go',
            })}
            {mode === 'signup' && pwField({
              label: t('auth_confirm_password'), value: confirm, onChange: setConfirm,
              ph: t('auth_confirm_password_ph'), tc: 'newPassword',
              onSubmit: submit, returnKey: 'go',
            })}

            {mode === 'login' && (
              <TouchableOpacity onPress={() => setMode('reset')} accessibilityRole="button" style={{ alignSelf: 'flex-end', marginTop: 10 }}>
                <Text style={{ fontSize: 13, color: '#4e7d4e', fontWeight: '600' }}>{t('auth_forgot')}</Text>
              </TouchableOpacity>
            )}

            {!!error && <Text style={{ color: '#a03030', fontSize: 13, marginTop: 14, textAlign: 'center' }}>{error}</Text>}
            {!!notice && <Text style={{ color: '#2d6a2d', fontSize: 13, marginTop: 14, textAlign: 'center', lineHeight: 19 }}>{notice}</Text>}

            <TouchableOpacity onPress={submit} disabled={busy} accessibilityRole="button" style={[s.btnPrimary, { alignSelf: 'stretch', marginTop: 20 }, busy && { backgroundColor: '#c0d0c0' }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>{cta}</Text>}
            </TouchableOpacity>

            {mode === 'login' && (
              <TouchableOpacity onPress={() => setMode('signup')} accessibilityRole="button" style={{ marginTop: 18, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: '#4e7d4e', fontWeight: '600' }}>{t('auth_to_signup')}</Text>
              </TouchableOpacity>
            )}
            {mode === 'signup' && (
              <TouchableOpacity onPress={() => setMode('login')} accessibilityRole="button" style={{ marginTop: 18, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: '#4e7d4e', fontWeight: '600' }}>{t('auth_to_login')}</Text>
              </TouchableOpacity>
            )}
            {mode === 'reset' && (
              <TouchableOpacity onPress={() => setMode('login')} accessibilityRole="button" style={{ marginTop: 18, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: '#4e7d4e', fontWeight: '600' }}>{t('auth_back_to_login')}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
        </>
        )}
      </SafeAreaViewSC>
    </Modal>
  );
}

// Collapsible settings row: shows the current selection as a one-line summary, expands to a
// dropdown of options on tap. Single-select collapses after choosing; multi-select stays open.
function SettingSelect({ label, sub, options, selectedIds, onToggle, multi = false, emptyLabel, headerIcon: HeaderIcon, iconBg = '#dcebdc', iconColor = THEME.primaryDark, t }) {
  const [open, setOpen] = useState(false);
  const chosen = options.filter(o => selectedIds.includes(o.id));
  const summaryText = chosen.length ? chosen.map(o => o.label).join(', ') : (emptyLabel || '—');
  // Single-select shows its icon (e.g. a flag) inline next to the summary text.
  const summaryIcon = chosen.length === 1 ? chosen[0].icon : null;
  // No card/border of its own — grouped by the caller into one shared, borderless section
  // (see the "phase → language" group in SettingsModal) with dividers between rows.
  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`${label}, ${summaryText}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {HeaderIcon ? (
          <View style={{ width: 38, alignItems: 'center' }}>
            <HeaderIcon size={24} color={THEME.primaryDark} />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '500', color: THEME.ink }}>{label}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
            {summaryIcon ? <Text importantForAccessibility="no" style={{ fontSize: 14 }}>{summaryIcon}</Text> : null}
            <Text numberOfLines={1} style={{ fontSize: 14, color: THEME.textMuted, fontWeight: '400' }}>{summaryText}</Text>
          </View>
        </View>
      </TouchableOpacity>
      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <Surface elevation={3} tinted={false} primaryColor={THEME.primary} style={{ backgroundColor: '#ffffff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 28, maxHeight: Dimensions.get('window').height * 0.75 }}>
          <View style={{ alignItems: 'center', paddingVertical: 10 }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#d0d8d0' }} /></View>
          <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '700', paddingHorizontal: 20 }}>{label}</Text>
          {sub ? <Text style={{ fontSize: 12, color: '#6b7a6b', paddingHorizontal: 20, paddingTop: 4 }}>{sub}</Text> : null}
          <ScrollView style={{ paddingHorizontal: 12, marginTop: 8 }}>
            {options.map(opt => {
              const isSel = selectedIds.includes(opt.id);
              return (
                <TouchableOpacity key={opt.id} onPress={() => { onToggle(opt.id); if (!multi) setOpen(false); }} accessibilityRole={multi ? 'checkbox' : 'radio'} accessibilityState={multi ? { checked: isSel } : { selected: isSel }} accessibilityLabel={opt.label} style={[s.onbOpt, { borderWidth: 0 }, isSel && s.onbOptOn]}>
                  {multi ? (
                    <View importantForAccessibility="no" style={{ width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: isSel ? '#4e7d4e' : '#c4cec4', backgroundColor: isSel ? '#4e7d4e' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {isSel && <CheckIcon color="#ffffff" size={13} />}
                    </View>
                  ) : (
                    <View importantForAccessibility="no" style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: isSel ? '#4e7d4e' : '#c4cec4', alignItems: 'center', justifyContent: 'center' }}>
                      {isSel && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#4e7d4e' }} />}
                    </View>
                  )}
                  {opt.icon ? <Text importantForAccessibility="no" style={{ fontSize: 20 }}>{opt.icon}</Text> : null}
                  <Text style={{ flex: 1, fontSize: 15 }}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {multi && (
            <TouchableOpacity onPress={() => setOpen(false)} accessibilityRole="button" style={[s.btnPrimary, { marginHorizontal: 20, marginTop: 12 }]}>
              <Text style={s.btnPrimaryText}>{t ? t('done') : 'Done'}</Text>
            </TouchableOpacity>
          )}
        </Surface>
      </BottomSheet>
    </>
  );
}

function SettingsModal({ visible, onClose, currentPhase, phaseStartDate, onOverride, profile, setProfile, isPremium, onUpgrade, onExport, langPref, setLangPref, onResetApp, onSeedDemo, onTogglePremium, onPreviewLevelUp, customFoods, onUpdateCustomFood, onDeleteCustomFood, user, onOpenAccount, onSignOut, syncing, lastSync, onSync, t }) {
  const [confirmReset, setConfirmReset] = useState(false);
  useEffect(() => { if (!visible) setConfirmReset(false); }, [visible]);
  const [editPhase, setEditPhase] = useState(currentPhase);
  const [weekInput, setWeekInput] = useState('1');
  useEffect(() => { setEditPhase(currentPhase); }, [currentPhase, visible]);
  const handleSave = () => {
    const week = parseInt(weekInput, 10);
    if (isNaN(week) || week < 1 || week > 12) return;
    onOverride(editPhase, week);
    onClose();
  };
  const setMenstruates = (val) => setProfile(Object.assign({}, profile, { menstruates: val }));
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaViewSC style={{ flex: 1, backgroundColor: '#e7f3df' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f4f0' }}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')} style={s.modalCloseBtn}><XIcon size={24} color={THEME.ink} /></TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '700' }}>{t('settings_title')}</Text>
        </View>
        <ScrollView style={{ flex: 1 }}>
          <View style={{ padding: 20 }}>
            {/* Account: sign in to back up & sync, or manage the signed-in account. */}
            {user ? (
              <View style={[s.cardOutlined, { marginHorizontal: 0 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#dcebdc', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 18 }}>🌿</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: '#6b7a6b' }}>{t('account_signed_in')}</Text>
                    <Text style={{ fontSize: 15, fontWeight: '700' }} numberOfLines={1}>{user.email}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
                  {syncing && <ActivityIndicator size="small" color="#4e7d4e" />}
                  <Text style={{ flex: 1, fontSize: 12, color: '#6b7a6b' }}>
                    {syncing ? t('sync_syncing') : lastSync ? t('sync_last', { time: new Date(lastSync).toLocaleTimeString(_uiLang, { hour: '2-digit', minute: '2-digit' }) }) : t('sync_never')}
                  </Text>
                  <TouchableOpacity onPress={onSync} disabled={syncing} accessibilityRole="button" accessibilityLabel={t('sync_now')}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: syncing ? '#a9b6a9' : '#4e7d4e' }}>{t('sync_now')}</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={onSignOut} accessibilityRole="button" style={[s.btnSecondary, { marginTop: 12 }]}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#4e7d4e' }}>{t('sign_out')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[s.cardFilled, { backgroundColor: '#f5faf5', marginHorizontal: 0 }]}>
                <Text style={{ fontSize: 15, fontWeight: '700' }}>{t('account')}</Text>
                <Text style={{ fontSize: 12, color: '#6b7a6b', marginTop: 2, marginBottom: 14 }}>{t('account_sub')}</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity onPress={() => onOpenAccount('login')} accessibilityRole="button" style={[s.btnSecondary, { flex: 1 }]}>
                    <Text style={s.btnSecondaryText}>{t('sign_in')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => onOpenAccount('signup')} accessibilityRole="button" style={[s.btnPrimary, { flex: 1, marginTop: 0 }]}>
                    <Text style={s.btnPrimaryText}>{t('sign_up')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {isPremium ? (
              <View style={[s.cardFilled, { backgroundColor: '#f5faf5', marginHorizontal: 0 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#dcebdc', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 18 }}>🌱</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#2d6a2d' }}>GutBloom Premium</Text>
                    <Text style={{ fontSize: 12, color: '#6b7a6b', marginTop: 2 }}>{t('settings_premium_active_sub')}</Text>
                  </View>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={() => { onClose(); setTimeout(onUpgrade, 250); }} style={[s.cardFilled, { backgroundColor: '#f5faf5', marginHorizontal: 0 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#dcebdc', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 20 }}>🌱</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700' }}>{t('upgrade_premium')}</Text>
                    <Text style={{ fontSize: 12, color: '#6b7a6b', marginTop: 2 }}>{t('settings_premium_sub')}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
            <View style={[s.cardFilled, { backgroundColor: '#f5faf5', marginHorizontal: 0, padding: 16, overflow: 'hidden' }]}>
              <SettingSelect
                headerIcon={IconCalendarWeekFilled}
                label={t('settings_current_phase')}
                sub={t('settings_mid_journey')}
                options={[{ id: 'not_started', label: t('settings_phase_not_started') }, { id: 'elimination', label: t('settings_phase_elimination') }, { id: 'reintroduction', label: t('settings_phase_reintroduction') }]}
                selectedIds={[editPhase]}
                onToggle={(id) => setEditPhase(id)}
                t={t}
              />
              {editPhase !== 'not_started' && (
                <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#dcebdc' }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 8 }}>{t('settings_week_label')}</Text>
                  <Text style={{ fontSize: 12, color: '#6b7a6b', marginBottom: 12 }}>{t('settings_week_sub')}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity onPress={() => setWeekInput(String(Math.max(1, (parseInt(weekInput, 10) || 1) - 1)))} accessibilityRole="button" accessibilityLabel={t('a11y_week_decrease')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#eaf1ea', alignItems: 'center', justifyContent: 'center' }}>
                      <IconMinus size={20} color="#4e7d4e" style={{ opacity: (parseInt(weekInput, 10) || 1) <= 1 ? 0.35 : 1 }} />
                    </TouchableOpacity>
                    <TextInput accessibilityLabel={t('a11y_week_number')} value={weekInput} onChangeText={setWeekInput} keyboardType="number-pad" placeholder={t('week_number_ph')} placeholderTextColor="#6b7a6b" style={{ flex: 1, backgroundColor: '#eaf1ea', borderRadius: 12, padding: 14, fontSize: 18, textAlign: 'center' }} />
                    <TouchableOpacity onPress={() => setWeekInput(String(Math.min(12, (parseInt(weekInput, 10) || 0) + 1)))} accessibilityRole="button" accessibilityLabel={t('a11y_week_increase')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#eaf1ea', alignItems: 'center', justifyContent: 'center' }}>
                      <IconPlus size={20} color="#4e7d4e" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
            <View style={[s.cardFilled, { backgroundColor: '#f5faf5', marginHorizontal: 0, padding: 16 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 38, alignItems: 'center' }}>
                  <IconDropletFilled size={24} color={THEME.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '500', color: THEME.ink }}>{t('settings_menstruate_q')}</Text>
                  <Text style={{ fontSize: 14, color: THEME.textMuted, fontWeight: '400', marginTop: 3 }}>{profile?.menstruates === 'yes' ? t('safety_yes') : t('safety_no')}</Text>
                </View>
                <Switch
                  value={profile?.menstruates === 'yes'}
                  onValueChange={(val) => setMenstruates(val ? 'yes' : 'no')}
                  trackColor={{ false: '#d8e0d8', true: '#4e7d4e' }}
                  thumbColor="#ffffff"
                  ios_backgroundColor="#d8e0d8"
                  accessibilityLabel={t('settings_menstruate_q')}
                />
              </View>
              <Text style={{ fontSize: 12, color: THEME.textMuted, lineHeight: 17, marginTop: 12 }}>{t('settings_menstruate_sub')}</Text>
            </View>
            <View style={[s.cardFilled, { backgroundColor: '#f5faf5', marginHorizontal: 0, padding: 16 }]}>
              <SettingSelect
                multi
                headerIcon={IconAlertTriangleFilled}
                label={t('settings_other_intolerances')}
                sub={t('settings_other_intolerances_sub')}
                emptyLabel={t('settings_none')}
                options={[
                  { id: 'histamine', icon: '🌡️', label: t('onb_known_histamine') },
                  { id: 'lactose', icon: '🥛', label: t('onb_known_lactose') },
                  { id: 'gluten', icon: '🌾', label: t('onb_known_gluten') },
                  { id: 'fructose', icon: '🍎', label: t('onb_known_fructose') },
                ]}
                selectedIds={(profile && profile.known) || []}
                onToggle={(id) => {
                  const known = (profile && profile.known) || [];
                  const next = known.indexOf(id) >= 0 ? known.filter(x => x !== id) : known.concat([id]);
                  setProfile(Object.assign({}, profile, { known: next }));
                }}
                t={t}
              />
            </View>
            <View style={[s.cardFilled, { backgroundColor: '#f5faf5', marginHorizontal: 0, padding: 16 }]}>
              <SettingSelect
                headerIcon={IconWorld}
                label={t('lang_label')}
                options={[
                  { id: 'auto', icon: '🌐', label: t('lang_auto') },
                  { id: 'en', icon: '🇬🇧', label: 'English' },
                  { id: 'de', icon: '🇩🇪', label: 'Deutsch' },
                  { id: 'es', icon: '🇪🇸', label: 'Español' },
                  { id: 'fr', icon: '🇫🇷', label: 'Français' },
                  { id: 'it', icon: '🇮🇹', label: 'Italiano' },
                ]}
                selectedIds={[langPref]}
                onToggle={(id) => setLangPref(id)}
                t={t}
              />
            </View>
            <View style={[s.cardOutlined, { marginHorizontal: 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: '600' }}>{t('settings_doctor_summary')}</Text>
                {!isPremium && <View style={{ backgroundColor: '#e8f0e8', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}><Text style={{ fontSize: 9, color: '#2d6a2d', fontWeight: '700' }}>PREMIUM</Text></View>}
              </View>
              <Text style={{ fontSize: 12, color: '#6b7a6b', marginBottom: 12 }}>{t('settings_doctor_sub')}</Text>
              <TouchableOpacity onPress={() => { onClose(); setTimeout(onExport, 250); }} accessibilityRole="button" accessibilityLabel={t('settings_doctor_export_btn')} style={[s.btnSecondary, { flexDirection: 'row', justifyContent: 'center', gap: 8 }]}>
                <IconReportMedical size={18} color="#2d6a2d" />
                <Text style={s.btnSecondaryText}>{t('settings_doctor_export_btn')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[s.btnPrimary, { marginTop: 8 }]} onPress={handleSave}><Text style={s.btnPrimaryText}>{t('settings_save_phase')}</Text></TouchableOpacity>

            {__DEV__ && (
            <View style={[s.cardFilled, { backgroundColor: '#f7f5fc', marginHorizontal: 0, marginTop: 20 }]}>
              <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 2 }}>🛠 Preview states (dev)</Text>
              <Text style={{ fontSize: 12, color: '#6b7a6b', marginBottom: 12 }}>Jump the app into a state to preview on your phone. Remove before launch.</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TouchableOpacity onPress={() => onSeedDemo('empty')} style={[s.btnSecondary, { flex: 1, paddingVertical: 12 }]}><Text style={s.btnSecondaryText}>First run</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => onSeedDemo('mid')} style={[s.btnSecondary, { flex: 1, paddingVertical: 12 }]}><Text style={s.btnSecondaryText}>A week in</Text></TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => onSeedDemo('elimDone')} style={{ backgroundColor: '#c08a3a', borderRadius: 16, padding: 14, alignItems: 'center', marginBottom: 8 }}><Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>🔒 Elimination done · reintro locked</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => onSeedDemo('max')} style={{ backgroundColor: '#7a5fc0', borderRadius: 16, padding: 14, alignItems: 'center', marginBottom: 8 }}><Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>✨ Thriving colony (max level)</Text></TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <TouchableOpacity onPress={() => onPreviewLevelUp({ level: 4, complete: false })} style={[s.btnSecondary, { flex: 1, paddingVertical: 12 }]}><Text style={s.btnSecondaryText}>🧫 New colony member</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => onPreviewLevelUp({ level: 13, complete: true })} style={[s.btnSecondary, { flex: 1, paddingVertical: 12 }]}><Text style={s.btnSecondaryText}>🎉 Colony complete</Text></TouchableOpacity>
              </View>
              <TouchableOpacity onPress={onTogglePremium} style={[s.btnSecondary, { paddingVertical: 12 }]}><Text style={s.btnSecondaryText}>Toggle Premium · now {isPremium ? 'ON' : 'OFF'}</Text></TouchableOpacity>
            </View>
            )}

            {customFoods && customFoods.length > 0 && (
              <View style={[s.cardOutlined, { marginHorizontal: 0, marginTop: 16 }]}>
                <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 4 }}>{t('settings_custom_foods')}</Text>
                <Text style={{ fontSize: 12, color: '#6b7a6b', marginBottom: 4 }}>{t('settings_custom_foods_sub')}</Text>
                {customFoods.map(f => (
                  <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f1f4f1' }}>
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: THEME.ink }}>{f.emoji} {f.name}</Text>
                    {['low', 'mod', 'high'].map(c => (
                      <TouchableOpacity key={c} onPress={() => onUpdateCustomFood(f.id, { cat: c })} accessibilityRole="radio" accessibilityState={{ selected: f.cat === c }} accessibilityLabel={c === 'low' ? t('meal_low') : c === 'high' ? t('meal_high') : t('meal_moderate')} style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: CAT_COLORS[c].dot, borderWidth: f.cat === c ? 3 : 0, borderColor: '#2d3a2d' }} />
                    ))}
                    <TouchableOpacity onPress={() => onDeleteCustomFood(f.id)} accessibilityRole="button" accessibilityLabel={t('edit_delete_btn')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 4 }}><XIcon size={15} color="#a03030" /></TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {__DEV__ && (
            <View style={[s.cardOutlined, { borderColor: '#f0d8d8', marginHorizontal: 0, marginTop: 16 }]}>
              <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 4 }}>{t('settings_start_over')} (dev only)</Text>
              <Text style={{ fontSize: 12, color: '#6b7a6b', marginBottom: 12 }}>{t('settings_start_over_sub')}</Text>
              {confirmReset ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={() => setConfirmReset(false)} style={[s.btnSecondary, { flex: 1 }]}><Text style={s.btnSecondaryText}>{t('cancel')}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={onResetApp} style={{ flex: 1, backgroundColor: '#c85050', borderRadius: 16, padding: 16, alignItems: 'center' }}><Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>{t('settings_reset_confirm')}</Text></TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setConfirmReset(true)} style={[s.btnSecondary, { borderColor: '#e6c4c4' }]}><Text style={{ color: '#a03030', fontSize: 14, fontWeight: '600' }}>{t('settings_reset_btn')}</Text></TouchableOpacity>
              )}
            </View>
            )}

            <View style={[s.cardFilled, { backgroundColor: '#f6f7f9', marginHorizontal: 0, marginTop: 16 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Text style={{ fontSize: 16 }}>ℹ️</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: THEME.ink }}>{t('settings_disclaimer_title')}</Text>
              </View>
              <Text style={{ fontSize: 12, color: '#6b7a6b', lineHeight: 18 }}>
                {t('settings_disclaimer_body')}
              </Text>
            </View>

            <View style={[s.cardOutlined, { marginHorizontal: 0, marginTop: 16, paddingVertical: 4 }]}>
              {[
                { label: t('settings_terms'), url: 'https://gutly.app/terms' },
                { label: t('settings_privacy'), url: 'https://gutly.app/privacy' },
              ].map((row, i) => (
                <TouchableOpacity key={row.label} onPress={() => Linking.openURL(row.url).catch(() => {})} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: '#f0f4f0' }}>
                  <Text style={{ flex: 1, fontSize: 14, color: THEME.ink }}>{row.label}</Text>
                  <IconExternalLink size={18} color="#647264" />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={{ fontSize: 11, color: '#647264', textAlign: 'center', marginTop: 14 }}>GutBloom v1.0.0</Text>
          </View>
        </ScrollView>
      </SafeAreaViewSC>
    </Modal>
  );
}

function EditEntryModal({ visible, entry, onClose, onUpdate, onDelete, onLogAgain, lang, t }) {
  const [when, setWhen] = useState(new Date());
  const [intensity, setIntensity] = useState(3);
  const [hours, setHours] = useState(7);
  const [level, setLevel] = useState(3);
  const [glasses, setGlasses] = useState(2);
  const [items, setItems] = useState([]);       // editable meal items: [{ foodId, size, portionG }]
  const [search, setSearch] = useState('');
  const [mealType, setMealType] = useState(null);
  // True once the user edits the ingredients of a meal that was logged as a prepared
  // dish. Removing or adding an ingredient means it's no longer that dish, so on save we
  // drop its dish identity (mealDishes) and it becomes a plain custom meal.
  const [dishCleared, setDishCleared] = useState(false);
  const wasDish = !!(entry && entry.mealDishes && entry.mealDishes.length > 0);
  const breakDishIfNeeded = () => { if (wasDish && !dishCleared) setDishCleared(true); };
  useEffect(() => {
    if (!entry) return;
    setWhen(entry.timestamp ? new Date(entry.timestamp) : new Date());
    setSearch('');
    setDishCleared(false);
    if (entry.type === 'symptom') setIntensity(entry.intensity || 3);
    if (entry.type === 'sleep') setHours(entry.hours || 7);
    if (entry.type === 'stress') setLevel(entry.level || 3);
    if (entry.type === 'water') setGlasses(entry.glasses || 2);
    if (entry.type === 'meal' && entry.items?.[0]) {
      // Rebuild per-ingredient sizes. Prefer a stored size; otherwise infer the closest
      // size from portionG (migrates entries saved before per-ingredient portions).
      setItems(entry.items.map(it => {
        const food = FOODS.find(f => f.id === it.foodId);
        let size = it.size;
        if (size !== 'S' && size !== 'M' && size !== 'L') {
          // Infer the closest size from the stored grams (handles both counted and
          // gram foods, and migrates entries saved before per-ingredient portions).
          const p = it.portionG || 0;
          size = p <= portionForItem(food, 'S') ? 'S' : p <= portionForItem(food, 'M') ? 'M' : 'L';
        }
        return { foodId: it.foodId, size, portionG: portionForItem(food, size) };
      }));
      setMealType(entry.mealType || defaultMealType(entry.timestamp ? new Date(entry.timestamp) : new Date()));
    }
  }, [entry]);
  if (!entry) return null;
  const effMealType = mealType || defaultMealType(when);
  // Change one ingredient's portion size within the edited meal.
  const setItemSize = (foodId, size) => setItems(items.map(x => x.foodId === foodId ? { foodId, size, portionG: portionForItem(FOODS.find(f => f.id === foodId), size) } : x));
  // One removable ingredient chip. Removing an ingredient of a logged dish breaks its dish
  // identity (breakDishIfNeeded), so the grouped view collapses back to a plain food list.
  const renderItemChip = (it) => {
    const f = FOODS.find(x => x.id === it.foodId);
    if (!f) return null;
    return (
      <TouchableOpacity key={it.foodId} onPress={() => { setItems(items.filter(x => x.foodId !== it.foodId)); breakDishIfNeeded(); }} accessibilityRole="button" accessibilityLabel={`${t('a11y_remove')}: ${foodName(f, lang)}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#e8f0e8', borderRadius: 14, paddingLeft: 10, paddingRight: 8, paddingVertical: 6 }}>
        <Text importantForAccessibility="no" style={{ fontSize: 14 }}>{f.emoji}</Text>
        <Text importantForAccessibility="no" style={{ fontSize: 13, color: '#2d6a2d', fontWeight: '500' }}>{foodName(f, lang)}</Text>
        <XIcon size={14} color="#4e7d4e" />
      </TouchableOpacity>
    );
  };
  const editFiltered = search.trim() ? FOODS.filter(f => {
    if (f.dishOnly) return false;   // combined dish-only meats aren't searchable
    const q = search.trim().toLowerCase();
    return f.name.toLowerCase().includes(q) || foodName(f, lang).toLowerCase().includes(q) || (f.alias || '').toLowerCase().includes(q);
  }).slice(0, 6) : [];
  const save = () => {
    const time = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
    const updates = { time, timestamp: when.toISOString() };
    if (entry.type === 'symptom') updates.intensity = intensity;
    if (entry.type === 'sleep') updates.hours = hours;
    if (entry.type === 'stress') updates.level = level;
    if (entry.type === 'water') updates.glasses = glasses;
    if (entry.type === 'meal' && entry.items) {
      if (items.length === 0) return;             // a meal must keep at least one food
      updates.items = items.map(it => ({ foodId: it.foodId, size: it.size, portionG: it.portionG }));
      updates.mealType = effMealType;
      if (dishCleared) updates.mealDishes = [];   // ingredients edited → no longer that dish
    }
    onUpdate(entry.id, updates);
    onClose();
  };
  const remove = () => { onDelete(entry.id); onClose(); };
  // A meal must keep at least one food; block (and dim) Save when it's been emptied.
  const canSave = !(entry.type === 'meal' && entry.items && items.length === 0);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaViewSC style={{ flex: 1, backgroundColor: '#fafbfa' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f4f0' }}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')} style={s.modalCloseBtn}><XIcon size={24} color={THEME.ink} /></TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '700' }}>{t('edit_title')}</Text>
        </View>
        <ScrollView style={{ flex: 1 }}>
          <View style={{ padding: 20 }}>
            <DateTimeRow value={when} onChange={setWhen} />
            {entry.type === 'meal' && entry.items && (
              <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#c4cec4', marginBottom: 16 }}>
                {/* Dish context — this meal was logged from a prepared dish; the foods below are its ingredients */}
                {wasDish && !dishCleared && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f0f6ef', borderRadius: 10, padding: 10, marginBottom: 14 }}>
                    <Text importantForAccessibility="no" style={{ fontSize: 18 }}>{FOODS.find(f => f.id === entry.mealDishes[0])?.emoji || '🍽️'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, color: THEME.textMuted, fontWeight: '600' }}>{t('edit_dish')}</Text>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: THEME.ink }}>{entry.mealDishes.map(id => foodName(FOODS.find(f => f.id === id), lang)).filter(Boolean).join(', ')}</Text>
                    </View>
                  </View>
                )}
                {/* Once its ingredients are edited, the dish becomes a plain custom meal */}
                {wasDish && dishCleared && (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#fff7ec', borderRadius: 10, padding: 10, marginBottom: 14 }}>
                    <BulbIcon size={16} color="#a06020" />
                    <Text style={{ flex: 1, fontSize: 12, color: '#7a5a20', lineHeight: 17 }}>{t('edit_now_custom')}</Text>
                  </View>
                )}
                {/* Meal-of-day */}
                <Text style={{ fontSize: 13, color: '#6b7a6b', marginBottom: 8 }}>{t('meal_type_label')}</Text>
                <MealTypeSelector value={effMealType} onChange={setMealType} t={t} style={{ marginBottom: 14 }} />
                {/* Foods — editable */}
                <Text style={{ fontSize: 13, color: '#6b7a6b', marginBottom: 8 }}>{t('meal_edit_foods')}</Text>
                {items.length === 0 ? (
                  <Text style={{ fontSize: 12, color: '#a03030', marginBottom: 10 }}>{t('meal_edit_none')}</Text>
                ) : (wasDish && !dishCleared) ? (
                  // Grouped by dish — each dish's ingredients under its own header, then any
                  // foods added on top. Reconstructed from the flat item list at render time.
                  (() => {
                    const { groups, extras } = groupMealItemsByDish(items, entry.mealDishes);
                    return (
                      <View style={{ gap: 14, marginBottom: 10 }}>
                        {groups.map(g => { const df = FOODS.find(x => x.id === g.dishId); return (
                          <View key={g.dishId}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: THEME.textSoft, marginBottom: 8 }}>{df ? `${df.emoji}  ${foodName(df, lang)}` : ''}</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{g.items.map(renderItemChip)}</View>
                          </View>
                        ); })}
                        {extras.length > 0 && (
                          <View>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: THEME.textSoft, marginBottom: 8 }}>{t('meal_edit_extras')}</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{extras.map(renderItemChip)}</View>
                          </View>
                        )}
                      </View>
                    );
                  })()
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    {items.map(renderItemChip)}
                  </View>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f4f7f2', borderRadius: 24, paddingHorizontal: 14, height: 44 }}>
                  <SearchIcon size={16} />
                  <TextInput value={search} onChangeText={setSearch} placeholder={t('meal_edit_add')} placeholderTextColor="#6b7a6b" accessibilityLabel={t('meal_edit_add')} style={{ flex: 1, paddingVertical: 10, fontSize: 14, marginLeft: 10 }} />
                </View>
                {editFiltered.length > 0 && (
                  <View style={{ marginTop: 6 }}>
                    {editFiltered.map(f => (
                      <TouchableOpacity key={f.id} onPress={() => { if (!items.find(x => x.foodId === f.id)) { setItems(items.concat([makeMealItem(f.id)])); breakDishIfNeeded(); } setSearch(''); }} accessibilityRole="button" accessibilityLabel={foodName(f, lang)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f1f4f1' }}>
                        <Text importantForAccessibility="no" style={{ fontSize: 18 }}>{f.emoji}</Text>
                        <Text style={{ flex: 1, fontSize: 14, color: THEME.ink }}>{foodName(f, lang)}</Text>
                        <RiskPill cat={f.cat} t={t} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {/* Portion — per ingredient */}
                {items.length > 0 && (
                  <>
                    <Text style={{ fontSize: 13, color: '#6b7a6b', marginTop: 16, marginBottom: 2 }}>{t('edit_portion')}</Text>
                    <Text style={{ fontSize: 13, color: '#3d4d3d', marginBottom: 12, lineHeight: 18 }}>{t('meal_portion_hint')}</Text>
                    {items.map((it, idx) => {
                      const f = FOODS.find(x => x.id === it.foodId);
                      if (!f) return null;
                      return (
                        <View key={it.foodId} style={{ marginBottom: idx === items.length - 1 ? 0 : 14 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <Text importantForAccessibility="no" style={{ fontSize: 15 }}>{f.emoji}</Text>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: THEME.ink }}>{foodName(f, lang)}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            {[{ id: 'S', label: t('edit_portion_s') }, { id: 'M', label: t('edit_portion_m') }, { id: 'L', label: t('edit_portion_l') }].map(p => {
                              const on = it.size === p.id;
                              return (
                                <TouchableOpacity key={p.id} onPress={() => setItemSize(it.foodId, p.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${foodName(f, lang)}, ${p.label}, ${itemSizeLabel(f, p.id, t, lang)}`} style={{ flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: on ? '#dcebdc' : '#c4cec4', backgroundColor: on ? '#dcebdc' : 'transparent', alignItems: 'center' }}>
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    {on && <CheckIcon color="#2d6a2d" size={13} />}
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: on ? '#2d6a2d' : '#2d3a2d' }}>{p.label}</Text>
                                  </View>
                                  <Text style={{ fontSize: 14, fontWeight: '600', marginTop: 3, color: on ? '#2d6a2d' : '#3d4d3d' }}>{itemSizeLabel(f, p.id, t, lang)}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}
                  </>
                )}
              </View>
            )}
            {entry.type === 'meal' && entry.items && (() => {
              // "How to make it low-FODMAP" — reuses the food-detail logic for each
              // high food in the meal: specific swaps when available, else generated tips.
              const seen = {};
              const sections = [];
              items.forEach(it => {
                const f = FOODS.find(x => x.id === it.foodId);
                if (!f || seen[f.id]) return;
                seen[f.id] = true;
                let lines = null;
                if (LOW_FODMAP_SWAPS[f.id]) {
                  lines = LOW_FODMAP_SWAPS[f.id].map((swap, idx) => swapText(f.id, idx, swap, lang));
                } else if (f.cat === 'high') {
                  const g = lightenGuidance(f, lang);
                  if (g.length) lines = g;
                }
                if (lines && lines.length) sections.push({ id: f.id, name: foodName(f, lang), lines });
              });
              if (sections.length === 0) return null;
              const multi = sections.length > 1;
              return (
                <View style={{ backgroundColor: '#f5faf5', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#c4cec4', marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={{ fontSize: 18 }}>🌱</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#2d6a2d' }}>{t('detail_lighten_head')}</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: '#6b7a6b', marginBottom: 12, lineHeight: 17 }}>{t('detail_lighten_sub')}</Text>
                  {sections.map((sec, si) => (
                    <View key={sec.id} style={{ borderTopWidth: si === 0 ? 0 : 1, borderTopColor: '#e0ece0', paddingTop: si === 0 ? 0 : 10, marginTop: si === 0 ? 0 : 8 }}>
                      {multi && <Text style={{ fontSize: 13, fontWeight: '700', color: '#2d3a2d', marginBottom: 4 }}>{sec.name}</Text>}
                      {sec.lines.map((ln, i) => (
                        <View key={i} style={{ flexDirection: 'row', gap: 10, paddingVertical: 6 }}>
                          <View style={{ marginTop: 1 }}><CheckIcon color="#4e7d4e" size={16} /></View>
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: '#2d3a2d' }}>{ln.name}</Text>
                            <Text style={{ fontSize: 12, color: '#6b7a6b', marginTop: 2, lineHeight: 17 }}>{ln.why}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              );
            })()}
            {entry.type === 'symptom' && (
              <>
                <Text style={{ fontSize: 13, color: '#6b7a6b', marginBottom: 12 }}>{entry.symptom} — {t('edit_intensity_label', { n: intensity })}</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <TouchableOpacity key={n} onPress={() => setIntensity(n)} accessibilityRole="radio" accessibilityState={{ selected: intensity === n }} accessibilityLabel={t('symptom_intensity', { n })} style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: n <= intensity ? `hsl(${15 - (n - 1) * 3}, 60%, ${65 - (n - 1) * 5}%)` : '#f0f4f0', alignItems: 'center' }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: n <= intensity ? 'white' : '#647264' }}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            {entry.type === 'sleep' && (
              <>
                <Text style={{ fontSize: 13, color: '#6b7a6b', marginBottom: 12 }}>{t('edit_hours_label', { n: hours })}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {[4, 5, 6, 7, 8, 9, 10].map(h => (
                    <TouchableOpacity key={h} onPress={() => setHours(h)} accessibilityRole="radio" accessibilityState={{ selected: hours === h }} accessibilityLabel={t('sleep_hours_label', { n: h })} style={{ width: 56, padding: 14, borderRadius: 12, backgroundColor: hours === h ? '#dcebdc' : 'transparent', borderWidth: 1, borderColor: hours === h ? '#dcebdc' : '#c4cec4', alignItems: 'center' }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: hours === h ? '#2d6a2d' : '#2d3a2d' }}>{h}h</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            {entry.type === 'stress' && (
              <>
                <Text style={{ fontSize: 13, color: '#6b7a6b', marginBottom: 12 }}>{t('edit_stress_label', { n: level })}</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 16 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <TouchableOpacity key={n} onPress={() => setLevel(n)} accessibilityRole="radio" accessibilityState={{ selected: level === n }} accessibilityLabel={t('stress_label', { label: n })} style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: n <= level ? `hsl(${15 - (n - 1) * 3}, 60%, ${65 - (n - 1) * 5}%)` : '#f0f4f0', alignItems: 'center' }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: n <= level ? 'white' : '#647264' }}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            {entry.type === 'water' && (
              <>
                <Text style={{ fontSize: 13, color: '#6b7a6b', marginBottom: 12 }}>{t('edit_water_label')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                    <TouchableOpacity key={n} onPress={() => setGlasses(n)} accessibilityRole="radio" accessibilityState={{ selected: glasses === n }} accessibilityLabel={n === 1 ? t('water_glasses_one', { n }) : t('water_glasses', { n })} style={{ width: 52, paddingVertical: 12, borderRadius: 12, backgroundColor: glasses === n ? '#dcebdc' : 'transparent', borderWidth: 1, borderColor: glasses === n ? '#4e7d4e' : '#c4cec4', alignItems: 'center' }}>
                      <Text importantForAccessibility="no" style={{ fontSize: 18 }}>💧</Text>
                      <Text style={{ fontSize: 14, fontWeight: '700', marginTop: 2, color: glasses === n ? '#2d6a2d' : '#2d3a2d' }}>{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <TouchableOpacity onPress={save} disabled={!canSave} accessibilityState={{ disabled: !canSave }} style={[s.btnPrimary, { opacity: canSave ? 1 : 0.4 }]}><Text style={s.btnPrimaryText}>{t('edit_save_btn')}</Text></TouchableOpacity>
            <TouchableOpacity onPress={remove} style={{ marginTop: 12, padding: 16, borderRadius: 16, alignItems: 'center', backgroundColor: '#fde0e0' }}>
              <Text style={{ color: '#a03030', fontSize: 15, fontWeight: '600' }}>{t('edit_delete_btn')}</Text>
            </TouchableOpacity>
            {/* Log again is a NEW entry, not an edit of this one — kept separate below a divider */}
            {entry.type === 'meal' && entry.items && onLogAgain && (
              <>
                <View style={{ height: 1, backgroundColor: '#c4cec4', marginTop: 24, marginBottom: 16 }} />
                <TouchableOpacity onPress={() => onLogAgain(entry)} accessibilityRole="button" accessibilityHint={t('edit_log_again_hint')} style={{ padding: 16, borderRadius: 16, alignItems: 'center', backgroundColor: '#e8f0e8' }}>
                  <Text style={{ color: '#2d6a2d', fontSize: 15, fontWeight: '700' }}>{t('edit_log_again')}</Text>
                </TouchableOpacity>
                <Text style={{ fontSize: 11.5, color: '#647264', textAlign: 'center', marginTop: 8, lineHeight: 16 }}>{t('edit_log_again_hint')}</Text>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaViewSC>
    </Modal>
  );
}

function StartTestModal({ visible, categoryId, onClose, onStart, t }) {
  const [selectedFood, setSelectedFood] = useState(null);
  useEffect(() => { setSelectedFood(null); }, [visible, categoryId]);
  if (!categoryId) return null;
  const foods = TEST_FOODS_PER_CATEGORY[categoryId] || [];
  const cat = REINTRO_ORDER.find(r => r.id === categoryId);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaViewSC style={{ flex: 1, backgroundColor: '#fafbfa' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f4f0' }}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')} style={s.modalCloseBtn}><XIcon size={24} color={THEME.ink} /></TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '700' }}>{t('test_modal_title', { name: cat?.name || '' })}</Text>
        </View>
        <ScrollView style={{ flex: 1 }}>
          <View style={{ padding: 20 }}>
            <Surface elevation={1} primaryColor={THEME.primary} style={[s.cardFilled, { backgroundColor: '#f5faf5', marginHorizontal: 0 }]}>
              <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 6 }}>{cat?.emoji} {t('test_protocol_badge')}</Text>
              <Text style={{ fontSize: 12, color: '#6b7a6b', lineHeight: 18 }}>
                {t('test_protocol_body', { rest: REST_DAYS_BETWEEN_TESTS })}
              </Text>
            </Surface>
            <Text style={{ fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 12 }}>{t('test_pick_food')}</Text>
            {foods.map(f => (
              <TouchableOpacity key={f.id} onPress={() => setSelectedFood(f)} accessibilityRole="radio" accessibilityState={{ selected: selectedFood?.id === f.id }} accessibilityLabel={f.name} style={{ padding: 14, borderRadius: 14, borderWidth: 2, borderColor: selectedFood?.id === f.id ? '#4e7d4e' : '#c4cec4', backgroundColor: selectedFood?.id === f.id ? '#e8f0e8' : 'white', marginBottom: 8 }}>
                <Text style={{ fontSize: 15, fontWeight: '600' }}>{f.name}</Text>
                <Text style={{ fontSize: 12, color: '#6b7a6b', marginTop: 4 }}>{t('test_day_portions', { s: f.small, m: f.medium, l: f.large })}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity disabled={!selectedFood} onPress={() => onStart(categoryId, selectedFood.id)} style={[s.btnPrimary, { opacity: selectedFood ? 1 : 0.5 }]}>
              <Text style={s.btnPrimaryText}>{t('test_start_btn')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaViewSC>
    </Modal>
  );
}

function ReintroPromptModal({ visible, info, onClose, onConfirm, t }) {
  const [reacted, setReacted] = useState(null);
  const [severity, setSeverity] = useState(2);
  useEffect(() => { if (visible) { setReacted(null); setSeverity(2); } }, [visible]);
  if (!info) return null;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 }}>
        <Surface accessibilityViewIsModal elevation={3} primaryColor={THEME.primary} style={{ backgroundColor: THEME.card, borderRadius: 24, padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={s.badge}><Text style={s.badgeText}>{t('test_badge')}</Text></View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')}><XIcon size={24} color="#647264" /></TouchableOpacity>
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', marginTop: 12 }}>{t('test_count_q')}</Text>
          <Text style={{ fontSize: 14, color: '#6b7a6b', marginTop: 6, lineHeight: 20 }}>
            {t('test_logged_q', { food: info.foodName, cat: info.categoryId })}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <TouchableOpacity onPress={() => setReacted(false)} accessibilityRole="radio" accessibilityState={{ selected: reacted === false }} accessibilityLabel={t('test_no_reaction')} style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: reacted === false ? '#4e7d4e' : '#c4cec4', backgroundColor: reacted === false ? '#e8f0e8' : 'white', alignItems: 'center' }}>
              <Text importantForAccessibility="no" style={{ fontSize: 22 }}>😊</Text>
              <Text style={{ fontSize: 12, marginTop: 4 }}>{t('test_no_reaction')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setReacted(true)} accessibilityRole="radio" accessibilityState={{ selected: reacted === true }} accessibilityLabel={t('test_reacted')} style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: reacted === true ? '#c85050' : '#c4cec4', backgroundColor: reacted === true ? '#fde0e0' : 'white', alignItems: 'center' }}>
              <Text importantForAccessibility="no" style={{ fontSize: 22 }}>😣</Text>
              <Text style={{ fontSize: 12, marginTop: 4 }}>{t('test_reacted')}</Text>
            </TouchableOpacity>
          </View>
          {reacted && (
            <>
              <Text style={{ fontSize: 13, color: '#6b7a6b', marginTop: 16, marginBottom: 8 }}>{t('test_how_bad', { n: severity })}</Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <TouchableOpacity key={n} onPress={() => setSeverity(n)} accessibilityRole="radio" accessibilityState={{ selected: severity === n }} accessibilityLabel={t('test_how_bad', { n })} style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: n <= severity ? `hsl(${15 - (n - 1) * 3}, 60%, ${65 - (n - 1) * 5}%)` : '#f0f4f0', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: n <= severity ? 'white' : '#647264' }}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          <TouchableOpacity disabled={reacted === null} onPress={() => onConfirm(reacted, severity)} style={[s.btnPrimary, { opacity: reacted === null ? 0.5 : 1 }]}>
            <Text style={s.btnPrimaryText}>{t('test_save_btn')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={{ marginTop: 8, padding: 12, alignItems: 'center' }}>
            <Text style={{ color: '#647264', fontSize: 13 }}>{t('test_skip_link')}</Text>
          </TouchableOpacity>
        </Surface>
      </View>
    </Modal>
  );
}

// Rendered as a plain section (a title + correlation items), not a boxed card,
// so it sits lighter on the home screen.
function InsightsCard({ log, lang, onOpenPatterns }) {
  const patterns = detectPatterns(log, lang);

  // Not enough data yet — a single muted line under the title, no heavy card.
  if (patterns.length === 0) {
    const entries = log.length;
    return (
      <View style={{ marginHorizontal: 20, marginBottom: 16, marginTop: 4 }}>
        <Text accessibilityRole="header" style={{ fontSize: 15, fontWeight: '600', color: THEME.ink, marginBottom: 6 }}>{tG('home_patterns')}</Text>
        <Text style={{ fontSize: 13, color: THEME.textMuted, lineHeight: 19 }}>
          {entries < 6
            ? tG('patterns_empty_early')
            : tG('patterns_empty_none')}
        </Text>
      </View>
    );
  }

  const sevLabel = { watch: tG('sev_watch'), maybe: tG('sev_maybe'), info: tG('sev_info'), good: tG('sev_good') };
  const shown = patterns.slice(0, 2);

  return (
    <View style={{ marginBottom: 8, marginTop: 4 }}>
      <View style={{ marginHorizontal: 20, marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Text accessibilityRole="header" style={{ fontSize: 15, fontWeight: '600', color: THEME.ink }}>{tG('home_patterns')}</Text>
        </View>
        <Text style={{ fontSize: 12, color: THEME.textMuted, marginTop: 2, lineHeight: 17 }}>{tG('patterns_sub')}</Text>
      </View>
      {shown.map(p => {
        const sev = PATTERN_SEV[p.severity];
        return (
          <View key={p.id} style={{ marginHorizontal: 20, marginBottom: 8, backgroundColor: sev.bg, borderWidth: 1, borderColor: sev.border, borderRadius: 14, padding: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Text style={{ fontSize: 18 }}>{p.icon}</Text>
              <View style={{ backgroundColor: sev.tag, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                <Text style={{ fontSize: 9, color: 'white', fontWeight: '700', letterSpacing: 0.3 }}>{sevLabel[p.severity]}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 4 }}>{p.title}</Text>
            <Text style={{ fontSize: 12, color: '#6b7a6b', lineHeight: 18 }}>{p.detail}</Text>
          </View>
        );
      })}
      {patterns.length > 2 && (
        <TouchableOpacity onPress={onOpenPatterns} accessibilityRole="button" style={{ alignItems: 'center', paddingVertical: 6 }}>
          <Text style={{ fontSize: 13, color: '#4e7d4e', fontWeight: '600' }}>{tG('patterns_see_all')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function TodaysMealsCard({ dayCount, onOpenRecipes, onOpenRecipe, lang }) {
  const meals = todaysMeals(Math.max(0, dayCount));
  return (
    <Surface elevation={1} primaryColor={THEME.primary} style={s.cardFilled}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text accessibilityRole="header" style={[s.cardTitle, { marginBottom: 0 }]}>{tG('home_eat_well')}</Text>
        <TouchableOpacity onPress={onOpenRecipes} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ paddingHorizontal: 6, paddingVertical: 6 }}>
          <Text style={{ fontSize: 14, color: THEME.primaryDark, fontWeight: '600' }}>{tG('recipes_all')}</Text>
        </TouchableOpacity>
      </View>
      <Text style={[s.cardText, { marginBottom: 12 }]}>{tG('home_meals_sub')}</Text>
      {meals.map(r => (
        <TouchableOpacity key={r.id} onPress={() => onOpenRecipe(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f0f4f0' }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#e8f0e8', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 22 }}>{r.emoji}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, color: '#4e7d4e', fontWeight: '700', letterSpacing: 0.5 }}>{tG('meal_' + r.meal).toUpperCase()}</Text>
            <Text style={{ fontSize: 14, fontWeight: '500', marginTop: 2 }}>{recipeTitle(r, lang)}</Text>
            <Text style={{ fontSize: 11, color: '#647264', marginTop: 2 }}>{r.minutes} min</Text>
          </View>
          <View importantForAccessibility="no"><ChevronIcon size={16} color="#647264" /></View>
        </TouchableOpacity>
      ))}
    </Surface>
  );
}

function RecipesScreen({ onOpenRecipe, onBack, backLabel, isPremium, freeLimit, onUpsell, t, lang }) {
  const [filter, setFilter] = useState('all');
  const filters = [
    { id: 'all', label: t('filter_all'), count: RECIPES.length },
    { id: 'breakfast', label: t('meal_breakfast'), count: RECIPES.filter(r => r.meal === 'breakfast').length },
    { id: 'lunch', label: t('meal_lunch'), count: RECIPES.filter(r => r.meal === 'lunch').length },
    { id: 'dinner', label: t('meal_dinner'), count: RECIPES.filter(r => r.meal === 'dinner').length },
    { id: 'snack', label: t('meal_snack'), count: RECIPES.filter(r => r.meal === 'snack').length },
  ];
  const list = filter === 'all' ? RECIPES : RECIPES.filter(r => r.meal === filter);
  // Free users: the first `freeLimit` recipes (by overall list order) are open; rest are locked.
  const freeIds = new Set(RECIPES.slice(0, freeLimit).map(r => r.id));
  const isLocked = (r) => !isPremium && !freeIds.has(r.id);

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>
      <AppBar title={t('recipes_title')} onBack={onBack} t={t} />
      {!isPremium && (
        <TouchableOpacity onPress={onUpsell} activeOpacity={0.9} style={{ marginHorizontal: 20, marginBottom: 14, borderRadius: 22, borderWidth: 1, borderColor: '#e8d8a8', backgroundColor: '#fffdf5', overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, paddingBottom: 12 }}>
            <View style={{ width: 92, height: 92, borderRadius: 20, backgroundColor: '#f3eede', alignItems: 'center', justifyContent: 'center' }}>
              <FloraCookbook size={84} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ alignSelf: 'flex-start', backgroundColor: '#f4e4b4', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3, marginBottom: 7 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: '#6b4e0c' }}>PREMIUM</Text>
              </View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: THEME.ink, letterSpacing: -0.3 }}>{t('recipes_upsell_headline')}</Text>
              <Text style={{ fontSize: 12, color: THEME.textMuted, marginTop: 3, lineHeight: 16 }}>{t('recipes_upsell_sub', { free: freeLimit, total: RECIPES.length })}</Text>
            </View>
          </View>
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            {[
              t('recipes_upsell_bullet1', { n: RECIPES.length }),
              t('recipes_upsell_bullet2'),
              t('recipes_upsell_bullet3'),
            ].map((b, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#e8f0e8', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckIcon color={THEME.primaryDark} size={11} />
                </View>
                <Text style={{ flex: 1, fontSize: 13, color: THEME.textSoft }}>{b}</Text>
              </View>
            ))}
            <View style={[s.btnPrimary, { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }]}>
              <IconLock size={17} color="#ffffff" />
              <Text style={s.btnPrimaryText}>{t('recipes_unlock_btn')}</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12, paddingHorizontal: 16 }}>
        {filters.map(f => (
          <TouchableOpacity key={f.id} onPress={() => setFilter(f.id)} accessibilityRole="radio" accessibilityState={{ selected: filter === f.id }} accessibilityLabel={f.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, backgroundColor: filter === f.id ? '#dcebdc' : 'transparent', borderWidth: 1, borderColor: filter === f.id ? '#dcebdc' : '#c4cec4', marginRight: 8 }}>
            {filter === f.id && <CheckIcon color="#2d6a2d" size={24} />}
            <Text style={{ fontSize: 14, fontWeight: filter === f.id ? '600' : '500', color: filter === f.id ? '#2d6a2d' : '#2d3a2d' }}>{f.label} · {f.count}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {list.map(r => {
        const locked = isLocked(r);
        return (
          <TouchableOpacity key={r.id} onPress={() => locked ? onUpsell() : onOpenRecipe(r)} style={[s.timelineRow, locked && { opacity: 0.7 }]}>
            <View style={[s.timelineDot, { backgroundColor: '#e8f0e8' }]}><Text style={{ fontSize: 20 }}>{locked ? '🔒' : r.emoji}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600' }}>{recipeTitle(r, lang)}</Text>
              <Text style={{ fontSize: 11, color: '#647264', marginTop: 2, textTransform: 'capitalize' }}>
                {locked ? t('recipe_premium_locked') : t('recipe_meta', { meal: t('meal_' + r.meal), min: r.minutes, ing: r.ingredientIds.length })}
              </Text>
            </View>
            <View importantForAccessibility="no"><ChevronIcon size={16} color="#647264" /></View>
          </TouchableOpacity>
        );
      })}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

function RecipeDetailModal({ visible, recipe, onClose, onLogAsMeal, lang, t }) {
  if (!recipe) return null;
  const ingredients = recipe.ingredientIds.map(id => FOODS.find(f => f.id === id)).filter(Boolean);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaViewSC style={{ flex: 1, backgroundColor: '#fafbfa' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f4f0' }}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')} style={s.modalCloseBtn}><XIcon size={24} color={THEME.ink} /></TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '700', flex: 1 }} numberOfLines={1}>{recipeTitle(recipe, lang)}</Text>
        </View>
        <ScrollView style={{ flex: 1 }}>
          <View style={{ alignItems: 'center', padding: 30, backgroundColor: '#e8f0e8' }}>
            <Text style={{ fontSize: 80 }}>{recipe.emoji}</Text>
          </View>
          <View style={{ padding: 20 }}>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <View style={[s.badgeGreen, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}><CheckIcon color={s.badgeGreenText.color} size={11} /><Text style={s.badgeGreenText}>{t('recipe_badge_safe')}</Text></View>
              <View style={[s.badge, { backgroundColor: '#f0f4f0' }]}><Text style={[s.badgeText, { color: '#6b7a6b' }]}>{recipe.minutes} min</Text></View>
            </View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#647264', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('recipe_ingredients')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {ingredients.map(f => (
                <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'white', borderWidth: 1, borderColor: '#c4cec4', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 }}>
                  <Text style={{ fontSize: 16 }}>{f.emoji}</Text>
                  <Text style={{ fontSize: 13 }}>{foodName(f, lang)}</Text>
                </View>
              ))}
            </View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#647264', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('recipe_how_to')}</Text>
            <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#c4cec4' }}>
              <Text style={{ fontSize: 14, lineHeight: 22, color: '#2d3a2d' }}>{recipeSteps(recipe, lang)}</Text>
            </View>
            <TouchableOpacity onPress={() => { onLogAsMeal(recipe); onClose(); }} style={s.btnPrimary}>
              <Text style={s.btnPrimaryText}>{t('recipe_log_full_btn')}</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 11, color: '#647264', textAlign: 'center', marginTop: 10 }}>
              {t('recipe_portions_note')}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaViewSC>
    </Modal>
  );
}


function ExportModal({ visible, onClose, report, t }) {
  const [shared, setShared] = useState(false);
  useEffect(() => { if (visible) setShared(false); }, [visible]);

  const doShare = async () => {
    try {
      await Share.share({ message: report, title: 'GutBloom Health Summary' });
      setShared(true);
    } catch (e) {
      // user cancelled or share unavailable — no-op
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaViewSC style={{ flex: 1, backgroundColor: '#fafbfa' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f4f0' }}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t('close')} style={s.modalCloseBtn}><XIcon size={24} color={THEME.ink} /></TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: '700' }}>{t('export_modal_title')}</Text>
        </View>
        <ScrollView style={{ flex: 1 }}>
          <View style={{ padding: 20 }}>
            <Surface elevation={1} primaryColor={THEME.primary} style={[s.cardFilled, { backgroundColor: '#f5faf5', marginHorizontal: 0 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Text style={{ fontSize: 20 }}>📄</Text>
                <Text style={{ fontSize: 14, fontWeight: '700' }}>{t('export_appt_title')}</Text>
              </View>
              <Text style={{ fontSize: 12, color: '#6b7a6b', lineHeight: 18 }}>
                {t('export_appt_body')}
              </Text>
            </Surface>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#647264', marginTop: 8, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('export_preview_label')}</Text>
            <View style={{ backgroundColor: 'white', borderRadius: 14, borderWidth: 1, borderColor: '#c4cec4', padding: 14 }}>
              <Text style={{ fontSize: 11, color: '#4a5a4a', lineHeight: 17, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>{report}</Text>
            </View>
            <TouchableOpacity onPress={doShare} style={s.btnPrimary}>
              <Text style={s.btnPrimaryText}>{shared ? t('export_share_again') : t('export_share')}</Text>
            </TouchableOpacity>
            {shared && (
              <Text style={{ fontSize: 12, color: '#2d6a2d', textAlign: 'center', marginTop: 10 }}>
                {t('export_shared_note')}
              </Text>
            )}
            <Text style={{ fontSize: 11, color: '#647264', textAlign: 'center', marginTop: 10, lineHeight: 16 }}>
              {t('export_disclaimer')}
            </Text>
            <View style={{ height: 30 }} />
          </View>
        </ScrollView>
      </SafeAreaViewSC>
    </Modal>
  );
}

const s = StyleSheet.create({
root: { flex: 1, backgroundColor: THEME.bg },
  screen: { flex: 1, backgroundColor: THEME.bg },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, paddingBottom: 8 },
  h1: { fontSize: 25, fontWeight: '800', letterSpacing: -0.5, color: THEME.ink },
  sub: { fontSize: 14, color: THEME.textSoft, marginTop: 3 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#4e7d4e', alignItems: 'center', justifyContent: 'center' },
  // Today sheet + section headers
  sheet: { marginTop: -28, backgroundColor: THEME.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 24, minHeight: 400 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: THEME.ink, letterSpacing: -0.2 },
  sectionLink: { fontSize: 14, fontWeight: '700', color: THEME.primary },
  moodTitle: { fontSize: 25, fontWeight: '800', letterSpacing: -0.4, color: THEME.ink, textAlign: 'center' },
  moodSub: { fontSize: 14.5, color: THEME.textSoft, marginTop: 6, lineHeight: 21, textAlign: 'center' },
  phasePill: { backgroundColor: '#e3efdd', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, marginTop: 14 },
  phasePillText: { fontSize: 13, fontWeight: '700', color: THEME.primaryDark },
  // M3 card variants — mutually exclusive: elevated (Surface, shadow), filled (tint), outlined (border).
  // Elevated cards go through <Surface elevation={1}> (see Surface.tsx) instead of a style key.
  cardFilled: { marginHorizontal: 20, marginBottom: 12, borderRadius: THEME.rCard, padding: 18 },
  cardOutlined: { marginHorizontal: 20, marginBottom: 12, backgroundColor: THEME.card, borderRadius: THEME.rCard, padding: 18, borderWidth: 1, borderColor: THEME.cardBorder },
  badge: { backgroundColor: '#fff4d0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start' },
  badgeText: { color: '#8a5a10', fontSize: 11, fontWeight: '600' },
  badgeRed: { backgroundColor: '#fde0e0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start' },
  badgeRedText: { color: '#a03030', fontSize: 11, fontWeight: '600' },
  badgeGreen: { backgroundColor: '#e0f0e0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, alignSelf: 'flex-start' },
  badgeGreenText: { color: '#2d6a2d', fontSize: 11, fontWeight: '600' },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardText: { fontSize: 13, color: '#6b7a6b', lineHeight: 19 },
  scanBtn: { flex: 1, backgroundColor: 'white', borderWidth: 1.5, borderColor: '#c4cec4', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 10, backgroundColor: 'white', borderRadius: 16, padding: 12, gap: 12 },
  timelineDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  timelineTitle: { fontSize: 14, fontWeight: '500' },
  timelineMeta: { fontSize: 12, color: '#647264', marginTop: 2 },
  timelineTime: { fontSize: 12, color: '#647264' },
  // Bottom nav bar (M3 level 2, 3dp). Pinned to the screen bottom, so the shadow needs to fall
  // upward toward the content above it — getElevation()'s default downward offset would be
  // invisible here (Android's ambient elevation shadow doesn't have this problem; only iOS's
  // fixed-direction shadowOffset does).
  tabBar: { flexDirection: 'row', backgroundColor: 'white', paddingBottom: 8, paddingTop: 8, ...getElevation(2), shadowOffset: { width: 0, height: -1.5 } },
  tabBtn: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 5 },
  plusBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  plusInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#4e7d4e', alignItems: 'center', justifyContent: 'center', marginTop: -22 },
  chatMsg: { maxWidth: '85%', padding: 12, borderRadius: 16, marginBottom: 10 },
  chatAI: { backgroundColor: 'white', alignSelf: 'flex-start', borderWidth: 1, borderColor: '#c4cec4', borderBottomLeftRadius: 4 },
  chatUser: { backgroundColor: '#4e7d4e', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  onbOpt: { backgroundColor: 'white', borderWidth: 1.5, borderColor: '#c4cec4', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  onbOptOn: { backgroundColor: '#e8f0e8', borderColor: '#4e7d4e' },
  btnPrimary: { backgroundColor: '#4e7d4e', borderRadius: 16, padding: 16, alignItems: 'center', marginTop: 16 },
  btnPrimaryText: { color: 'white', fontSize: 16, fontWeight: '600' },
  btnSecondary: { backgroundColor: 'white', borderWidth: 1.5, borderColor: '#c4cec4', borderRadius: 16, padding: 16, alignItems: 'center' },
  btnSecondaryText: { color: '#2d6a2d', fontSize: 14, fontWeight: '600' },
  modalCloseBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  toast: { position: 'absolute', bottom: 100, alignSelf: 'center', backgroundColor: '#2d3a2d', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24 },
  toastText: { color: 'white', fontSize: 14 },
});