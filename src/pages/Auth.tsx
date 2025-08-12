import React, { useEffect } from "react";
import { SignIn, SignUp, SignedOut, useUser } from "@clerk/clerk-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";

const Auth = () => {
  const { isSignedIn } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Sign in or Sign up | Looply"; // SEO title
    const desc = "Join Looply: sign in or create an account to share music-inspired creations.";
    const metaDesc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (metaDesc) metaDesc.content = desc;
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = desc;
      document.head.appendChild(m);
    }
    const canonicalHref = `${window.location.origin}/auth`;
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonicalHref;
  }, []);

  useEffect(() => {
    if (isSignedIn) navigate("/", { replace: true });
  }, [isSignedIn, navigate]);

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto max-w-5xl px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Sign in or create your Looply account</h1>
          <p className="text-muted-foreground mt-2">Start posting songs and creative responses.</p>
        </div>

        <div className="mx-auto max-w-xl">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6">
              <SignedOut>
                <div className="flex justify-center">
                  <SignIn fallbackRedirectUrl="/" appearance={{ elements: { card: "shadow-lg" } }} />
                </div>
              </SignedOut>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <SignedOut>
                <div className="flex justify-center">
                  <SignUp fallbackRedirectUrl="/" appearance={{ elements: { card: "shadow-lg" } }} />
                </div>
              </SignedOut>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  );
};

export default Auth;
