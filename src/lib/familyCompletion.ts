/** نسبة اكتمال بيانات الأسرة وقائمة النواقص بلغة واضحة. */
export function familyCompletion(profile: any, app: any, members: any[]) {
  const checks: [boolean, string][] = [
    [!!profile?.full_name, "اسم رب الأسرة"],
    [/^\d{9}$/.test(profile?.national_id || ""), "رقم هوية رب الأسرة"],
    [!!profile?.phone, "رقم الجوال"],
    [!!profile?.alt_phone, "رقم جوال بديل"],
    [!!profile?.birth_date, "تاريخ ميلاد رب الأسرة"],
    [!!profile?.id_card_url, "صورة هوية رب الأسرة"],
    [!!app, "بيانات السكن"],
    [!!app?.original_residence, "مكان السكن الأصلي"],
    [!!app?.current_landmark, "المعلم القريب من السكن الحالي"],
  ];
  for (const m of members.filter((x) => !x.is_head)) {
    checks.push([/^\d{9}$/.test(m.national_id || ""), `رقم هوية ${m.full_name || "فرد"}`]);
    if (m.is_war_injured) checks.push([!!m.injury_report_url, `تقرير إصابة ${m.full_name}`]);
  }
  const done = checks.filter(([ok]) => ok).length;
  return {
    percent: checks.length ? Math.round((done / checks.length) * 100) : 0,
    missing: checks.filter(([ok]) => !ok).map(([, l]) => l),
  };
}
