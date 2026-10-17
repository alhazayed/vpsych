/**
 * Translation key for the patient's speaker label in transcripts and
 * captions. Arabic marks gender ("المريض" / "المريضة"); English uses
 * "Patient" for both keys.
 */
export function patientLabelKey(gender: string | null | undefined): "patient" | "patientFemale" {
  return gender?.trim().toLowerCase() === "female" ? "patientFemale" : "patient";
}
