import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { Script } from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as filters from "../lib/filters";
import * as readiness from "../lib/account-readiness";
import * as validation from "../lib/validation";

test("Join login renders signup intent and sends it through the real server action", async () => {
 const originalSite = process.env.NEXT_PUBLIC_SITE_URL;
 process.env.NEXT_PUBLIC_SITE_URL = "https://cfh.example.invalid";
 const requireModule = createRequire(import.meta.url);
 type OtpRequest = {email:string;options:{shouldCreateUser:boolean;emailRedirectTo:string}};
 const requests: OtpRequest[] = [];
 let providerMode: "new" | "existing" | "error" | "throw" = "new";
 const db = {
  from: () => ({select: () => ({limit: () => ({abortSignal: async () => ({error:null})})})}),
  auth: {signInWithOtp: async (request: OtpRequest) => {
   requests.push(request);
   if (providerMode === "throw") throw new Error("Account already exists: private-address@example.invalid");
   return {error: providerMode === "error" || (providerMode === "new" && !request.options.shouldCreateUser)
    ? {message:"Signups not allowed for otp: private-address@example.invalid",status:422} : null};
  }},
 };
 // Compile the actual page, client form and server action, replacing only
 // framework request context and external services. No email/network is used.
 const modules = new Map<string, Record<string, unknown>>();
 function load(file: string): Record<string, unknown> {
  const cached = modules.get(file); if (cached) return cached;
  const exports: Record<string, unknown> = {};
  const dependencies: Record<string, unknown> = {
   "@/lib/supabase": {configured:()=>true,isDemo:()=>false,createClient:async()=>db},
   "@/lib/filters":filters, "@/lib/account-readiness":readiness, "@/lib/validation":validation,
   "next/headers":{headers:async()=>new Headers({origin:"https://cfh.example.invalid"})},
   "next/navigation":{redirect:()=>{throw new Error("Unexpected redirect");}},
   "next/cache":{revalidatePath:()=>{}},
   "next/link":{__esModule:true,default:({children,href}:{children:React.ReactNode;href:string})=>React.createElement("a",{href},children)},
   "@/components/ui":{PageIntro:({children,title}:{children:React.ReactNode;title:string})=>React.createElement("section",null,React.createElement("h1",null,title),children)},
  };
  const code = ts.transpileModule(readFileSync(resolve(file),"utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  new Script(code,{filename:file}).runInNewContext({exports,process,URL,AbortSignal,FormData,Error,require:(name:string)=>{
   if (name in dependencies) return dependencies[name];
   if (name === "@/app/actions") return load("app/actions.ts");
   if (name === "@/components/login-form") return load("components/login-form.tsx");
   return requireModule(name);
  }});
  modules.set(file,exports);
  return exports;
 }
 try {
  const Login = load("app/login/page.tsx").default as (props:{searchParams:Promise<{next?:string}>})=>Promise<React.ReactNode>;
  const signIn = load("app/actions.ts").signIn as (state:object,form:FormData)=>Promise<{error?:string;message?:string}>;
  const enter = async (next?:string) => {
   const html = renderToStaticMarkup(await Login({searchParams:Promise.resolve({next})}));
   const form = new FormData();
   for (const name of ["next","intent"]) {
    const match = html.match(new RegExp(`name="${name}" value="([^"]*)"`));
    assert.ok(match,`Real form must render ${name}`);
    form.set(name,match[1].replaceAll("&amp;","&"));
   }
   form.set("email","new-person@example.invalid"); form.set("provider","email");
   return {html,result:await signIn({},form)};
  };
  const join = await enter("/join");
  assert.match(join.html,/Verify your email to create an account or sign in/);
  assert.match(join.html,/Send a verification link/);
  assert.equal(join.result.error,undefined,"New user must not hit the provider's signin-only 422");
  assert.match(join.result.message!,/verification link/);
  assert.equal(requests[0].options.shouldCreateUser,true);
  assert.equal(new URL(requests[0].options.emailRedirectTo).searchParams.get("next"),"/join");
  assert.equal((await enter("/join?from=invite")).result.error,undefined);
  providerMode="existing";
  assert.equal((await enter("/join")).result.error,undefined,"Existing members can use the same Join entry");
  const normal = await enter();
  assert.match(normal.html,/Send a sign-in link/);
  assert.equal(requests.at(-1)!.options.shouldCreateUser,false,"Ordinary login remains explicit signin");
  await enter("https://untrusted.invalid/join");
  assert.equal(requests.at(-1)!.options.shouldCreateUser,false);
  assert.equal(new URL(requests.at(-1)!.options.emailRedirectTo).searchParams.get("next"),"/account");
  providerMode="error";
  const returned = await enter("/join");
  assert.match(returned.result.error!,/could not be sent/);
  assert.doesNotMatch(returned.result.error!,/Signups|exists|private-address|422/);
  providerMode="throw";
  const thrown = await enter("/join");
  assert.match(thrown.result.error!,/could not be started/);
  assert.doesNotMatch(thrown.result.error!,/exists|private-address/);
 } finally {
  if (originalSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL=originalSite;
 }
});
