import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useUser, UserButton } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  Home, 
  Search, 
  Upload, 
  Trophy, 
  User, 
  Sparkles,
  Music
} from "lucide-react";

const navItems = [
  { label: "Feed", href: "/feed", icon: Home },
  { label: "Discover", href: "/discover", icon: Search },
  { label: "Upload", href: "/upload", icon: Upload },
  { label: "Challenges", href: "/challenges", icon: Trophy },
  { label: "AI Hub", href: "/ai", icon: Sparkles },
];

export function Navigation() {
  const location = useLocation();
  const { user, isSignedIn } = useUser();

  return (
    <>
      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center space-x-6">
          <Link to="/feed" className="flex items-center space-x-2">
            <Music className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Looply</span>
          </Link>
          
          <div className="flex items-center space-x-4">
            {navItems.map((item) => (
              <Button
                key={item.href}
                variant={location.pathname === item.href ? "default" : "ghost"}
                size="sm"
                asChild
              >
                <Link to={item.href} className="flex items-center space-x-2">
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              </Button>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {isSignedIn ? (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/profile/${user.id}`}>
                  <User className="h-4 w-4 mr-2" />
                  Profile
                </Link>
              </Button>
              <UserButton 
                appearance={{
                  elements: {
                    avatarBox: "h-8 w-8"
                  }
                }}
              />
            </>
          ) : (
            <Button asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
          )}
        </div>
      </nav>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t z-50">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => (
            <Button
              key={item.href}
              variant="ghost"
              size="sm"
              asChild
              className={cn(
                "flex-col h-auto py-2 px-3",
                location.pathname === item.href && "text-primary"
              )}
            >
              <Link to={item.href}>
                <item.icon className="h-5 w-5" />
                <span className="text-xs mt-1">{item.label}</span>
              </Link>
            </Button>
          ))}
        </div>
      </nav>
    </>
  );
}