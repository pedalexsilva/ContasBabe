"use client";
import Link from 'next/link';
import { Home, BookOpen, BellRing, BarChart3, Settings, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/ThemeToggle';
import { BloomingFlowerIcon } from '@/components/icons/BloomingFlowerIcon';
import { APP_NAME } from '@/lib/constants';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/journal', label: 'Journal', icon: BookOpen },
  { href: '/reminders', label: 'Reminders', icon: BellRing },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppHeader() {
  const pathname = usePathname();

  const NavLink = ({ href, label, icon: Icon, isMobile = false }: { href: string, label: string, icon: React.ElementType, isMobile?: boolean }) => {
    const isActive = pathname === href;
    const LinkContent = () => (
      <>
        <Icon className={cn("h-5 w-5", isMobile ? "mr-3" : "md:mr-2")} />
        {label}
      </>
    );

    if (isMobile) {
      return (
        <SheetClose asChild>
          <Link
            href={href}
            className={cn(
              "flex items-center px-4 py-3 text-lg rounded-md hover:bg-accent hover:text-accent-foreground",
              isActive ? "bg-accent text-accent-foreground font-semibold" : "text-foreground"
            )}
          >
            <LinkContent />
          </Link>
        </SheetClose>
      );
    }

    return (
      <Button asChild variant={isActive ? "secondary" : "ghost"} size="sm">
        <Link href={href} className="flex items-center">
          <LinkContent />
        </Link>
      </Button>
    );
  };
  
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-xl font-semibold text-primary">
          <BloomingFlowerIcon className="h-7 w-7 text-primary" />
          <span className="hidden sm:inline">{APP_NAME}</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-2">
          {navItems.map((item) => (
            <NavLink key={item.label} {...item} />
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {/* Mobile Navigation */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] p-0">
                <div className="flex flex-col h-full">
                  <div className="p-6 border-b">
                    <Link href="/" className="flex items-center gap-2 text-xl font-semibold text-primary">
                      <BloomingFlowerIcon className="h-7 w-7 text-primary" />
                      <span>{APP_NAME}</span>
                    </Link>
                  </div>
                  <nav className="flex-grow p-4 space-y-2">
                    {navItems.map((item) => (
                       <NavLink key={item.label} {...item} isMobile={true} />
                    ))}
                  </nav>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
