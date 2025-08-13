import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="w-full border-b">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <a href="/" className="font-semibold">Looply</a>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/feed">Feed</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/post">Post</Link>
            </Button>
            <SignedOut>
              <Button asChild variant="default" size="sm">
                <Link to="/auth">Sign in</Link>
              </Button>
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-4xl font-bold mb-4">Welcome to Looply</h1>
          <p className="text-xl text-muted-foreground mb-6">
            Post your favorite song and get inspired by the community.
          </p>
          <SignedOut>
            <Button asChild size="lg">
              <Link to="/auth">Get started</Link>
            </Button>
          </SignedOut>
          <SignedIn>
            <p className="text-muted-foreground">You’re signed in — explore and start creating!</p>
          </SignedIn>
        </div>
      </main>
    </div>
  );
};

export default Index;

