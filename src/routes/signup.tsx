import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { z } from "zod";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/signup")({
  component: SignUp,
  head: () => ({
    meta: [
      { title: "Sign Up — BeyondSAT" },
      { name: "description", content: "Create your free BeyondSAT account and start practicing for the Digital SAT." },
    ],
  }),
});

const schema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(60),
  last_name: z.string().trim().min(1, "Last name is required").max(60),
  city: z.string().trim().min(1, "City is required").max(80),
  school: z.string().trim().min(1, "School is required").max(120),
  grade: z.enum(["5", "6", "7", "8", "9", "10", "11", "12", "graduated"], { errorMap: () => ({ message: "Select your grade" }) }),
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
        emailRedirectTo: `${window.location.origin}/dashboard`,
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
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteNav />
      <main className="flex-1 grid place-items-center px-4 py-14">
        <div className="w-full max-w-lg rounded-2xl bg-white p-8 md:p-10 soft-shadow border border-border">
          {step === "form" ? (
            <>
              <h1 className="text-2xl md:text-3xl text-primary text-center">Create your account</h1>
              <p className="mt-2 text-sm text-slate-600 text-center">
                Start practicing for the Digital SAT in minutes.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First name" error={errors.first_name}>
                    <input className={inputCls} value={form.first_name} onChange={(e) => setField("first_name", e.target.value)} autoComplete="given-name" />
                  </Field>
                  <Field label="Last name" error={errors.last_name}>
                    <input className={inputCls} value={form.last_name} onChange={(e) => setField("last_name", e.target.value)} autoComplete="family-name" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="City" error={errors.city}>
                    <input className={inputCls} value={form.city} onChange={(e) => setField("city", e.target.value)} autoComplete="address-level2" />
                  </Field>
                  <Field label="School" error={errors.school}>
                    <input className={inputCls} value={form.school} onChange={(e) => setField("school", e.target.value)} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Grade" error={errors.grade}>
                    <select className={inputCls} value={form.grade} onChange={(e) => setField("grade", e.target.value as FormValues["grade"])}>
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
                    <input type="date" className={inputCls} value={form.birth_date} onChange={(e) => setField("birth_date", e.target.value)} />
                  </Field>
                </div>
                <Field label="Email" error={errors.email}>
                  <input type="email" className={inputCls} value={form.email} onChange={(e) => setField("email", e.target.value)} autoComplete="email" />
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center text-slate-500 hover:text-primary"
                      aria-label={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>

                {formError && <p className="text-sm text-red-600">{formError}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition inline-flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign Up
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-600">
                Already have an account?{" "}
                <Link to="/signin" className="font-semibold text-primary hover:underline">
                  Sign In
                </Link>
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl md:text-3xl text-primary text-center">Verify your email</h1>
              {info && <p className="mt-2 text-sm text-slate-600 text-center">{info}</p>}
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
                  className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition inline-flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />} Verify
                </button>
              </form>
              <div className="mt-6 flex items-center justify-between text-sm">
                <button onClick={handleResend} className="font-semibold text-primary hover:underline">
                  Resend code
                </button>
                <button onClick={() => setStep("form")} className="text-slate-500 hover:text-primary">
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
  "w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-700">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
