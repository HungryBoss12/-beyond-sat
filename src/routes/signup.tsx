import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { z } from "zod";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { appUrl } from "@/lib/app-url";

export const Route = createFileRoute("/signup")({
  component: SignUp,
  head: () => ({
    meta: [
      { title: "Sign Up — BeyondSAT" },
      {
        name: "description",
        content: "Create your free BeyondSAT account and start practicing for the Digital SAT.",
      },
    ],
  }),
});

const schema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(60),
  last_name: z.string().trim().min(1, "Last name is required").max(60),
  city: z.string().trim().min(1, "City is required").max(80),
  school: z.string().trim().min(1, "School is required").max(120),
  grade: z.enum(["5", "6", "7", "8", "9", "10", "11", "12", "graduated"], {
    errorMap: () => ({ message: "Select your grade" }),
  }),
  birth_date: z.string().min(1, "Date of birth is required"),
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

type FormValues = z.infer<typeof schema>;

const emptyForm: FormValues = {
  first_name: "",
  last_name: "",
  city: "",
  school: "",
  grade: "" as unknown as FormValues["grade"],
  birth_date: "",
  email: "",
  password: "",
};

function SignUp() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "verify">("form");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Redirect signed-in users
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  function setField<K extends keyof FormValues>(k: K, v: FormValues[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Partial<Record<keyof FormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof FormValues;
        if (!errs[k]) errs[k] = issue.message;
      }
      setErrors(errs);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: appUrl("/dashboard"),
        data: {
          first_name: parsed.data.first_name,
          last_name: parsed.data.last_name,
          city: parsed.data.city,
          school: parsed.data.school,
          grade: parsed.data.grade === "graduated" ? "13" : parsed.data.grade,
          birth_date: parsed.data.birth_date,
        },
      },
    });
    setLoading(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    setStep("verify");
    setInfo(`We sent a 6-digit verification code to ${parsed.data.email}.`);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setOtpError(null);
    if (otp.length !== 6) {
      setOtpError("Enter the 6-digit code from your email.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: form.email,
      token: otp,
      type: "signup",
    });
    setLoading(false);
    if (error) {
      setOtpError(error.message);
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  async function handleResend() {
    setInfo(null);
    setOtpError(null);
    const { error } = await supabase.auth.resend({ type: "signup", email: form.email });
    if (error) setOtpError(error.message);
    else setInfo("A new code has been sent to your email.");
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteNav />
      <main className="grid flex-1 place-items-center px-4 py-14">
        <div className="rise-in w-full max-w-lg rounded-2xl border border-brand-400/40 bg-brand-600 p-8 shadow-panel md:p-10">
          {step === "form" ? (
            <>
              <h1 className="text-center text-2xl font-black tracking-tight text-white md:text-3xl">
                Create your account
              </h1>
              <p className="mt-2 text-center text-sm text-brand-100">
                Start practicing for the Digital SAT in minutes.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First name" error={errors.first_name}>
                    <input
                      className={inputCls}
                      value={form.first_name}
                      onChange={(e) => setField("first_name", e.target.value)}
                      autoComplete="given-name"
                    />
                  </Field>
                  <Field label="Last name" error={errors.last_name}>
                    <input
                      className={inputCls}
                      value={form.last_name}
                      onChange={(e) => setField("last_name", e.target.value)}
                      autoComplete="family-name"
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="City" error={errors.city}>
                    <input
                      className={inputCls}
                      value={form.city}
                      onChange={(e) => setField("city", e.target.value)}
                      autoComplete="address-level2"
                    />
                  </Field>
                  <Field label="School" error={errors.school}>
                    <input
                      className={inputCls}
                      value={form.school}
                      onChange={(e) => setField("school", e.target.value)}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Grade" error={errors.grade}>
                    <select
                      className={inputCls}
                      value={form.grade}
                      onChange={(e) => setField("grade", e.target.value as FormValues["grade"])}
                    >
                      <option value="">Select…</option>
                      <option value="5">5th</option>
                      <option value="6">6th</option>
                      <option value="7">7th</option>
                      <option value="8">8th</option>
                      <option value="9">9th</option>
                      <option value="10">10th</option>
                      <option value="11">11th</option>
                      <option value="12">12th</option>
                      <option value="graduated">Graduated</option>
                    </select>
                  </Field>
                  <Field label="Date of birth" error={errors.birth_date}>
                    <input
                      type="date"
                      className={inputCls}
                      value={form.birth_date}
                      onChange={(e) => setField("birth_date", e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Email" error={errors.email}>
                  <input
                    type="email"
                    className={inputCls}
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    autoComplete="email"
                  />
                </Field>
                <Field label="Password" error={errors.password}>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      className={inputCls + " pr-10"}
                      value={form.password}
                      onChange={(e) => setField("password", e.target.value)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      className="tap absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-brand-100 hover:text-white"
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>

                {/* Red text can't survive on brand navy, so form-level errors use the
                    deep chip treatment instead of hue. */}
                {formError && (
                  <p className="rounded-lg bg-brand-900 px-3 py-2 text-sm font-semibold text-white ring-1 ring-brand-300/60">
                    {formError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-brand inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-400 px-4 py-3 text-sm font-bold text-white disabled:pointer-events-none disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign Up
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-brand-100">
                Already have an account?{" "}
                <Link to="/signin" className="font-bold text-white hover:underline">
                  Sign In
                </Link>
              </p>
            </>
          ) : (
            <>
              <h1 className="text-center text-2xl font-black tracking-tight text-white md:text-3xl">
                Verify your email
              </h1>
              {info && <p className="mt-2 text-center text-sm text-brand-100">{info}</p>}
              <form onSubmit={handleVerify} className="mt-8 space-y-4">
                <Field label="6-digit code" error={otpError ?? undefined}>
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    className={inputCls + " tracking-[0.5em] text-center text-lg"}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    autoFocus
                  />
                </Field>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-brand inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-400 px-4 py-3 text-sm font-bold text-white disabled:pointer-events-none disabled:opacity-60"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />} Verify
                </button>
              </form>
              <div className="mt-6 flex items-center justify-between text-sm">
                <button onClick={handleResend} className="font-bold text-white hover:underline">
                  Resend code
                </button>
                <button
                  onClick={() => setStep("form")}
                  className="font-semibold text-brand-100 hover:text-white"
                >
                  ← Back
                </button>
              </div>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2.5 text-sm text-white outline-none transition [color-scheme:dark] placeholder:text-brand-200 focus:border-brand-200";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-brand-100">{label}</span>
      {children}
      {/* Field errors read through weight and the light step, never red. */}
      {error && <span className="mt-1 block text-xs font-bold text-brand-100">{error}</span>}
    </label>
  );
}
