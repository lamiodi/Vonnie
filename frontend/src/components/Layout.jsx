import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  HomeIcon,
  CalendarIcon,
  ShoppingCartIcon,
  ChartBarIcon,
  CubeIcon,
  UserGroupIcon,
  ClockIcon,
  TicketIcon,
  DocumentReportIcon,
  LogoutIcon,
  MenuIcon,
  XIcon,
  UserIcon,
  CogIcon
} from '@heroicons/react/outline';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, hasRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [sidebarOpen]);

  const isAdmin = hasRole && hasRole('admin');

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Bookings', href: '/bookings', icon: CalendarIcon },
    { name: 'POS', href: '/pos', icon: ShoppingCartIcon },
    { name: 'Inventory', href: '/inventory', icon: CubeIcon },
    { name: 'Workers', href: '/workers', icon: UserGroupIcon },
    { name: 'Attendance', href: '/attendance', icon: ClockIcon },
    { name: 'Coupons', href: '/coupons', icon: TicketIcon },
    { name: 'Reports', href: '/reports', icon: DocumentReportIcon },
    { name: 'Transactions', href: '/transactions', icon: DocumentReportIcon },
    ...(isAdmin ? [{ name: 'Admin Settings', href: '/admin-settings', icon: CogIcon }] : []),
  ];

  // Bottom nav shows most-used items for quick mobile access
  const bottomNavItems = [
    { name: 'Home', href: '/dashboard', icon: HomeIcon },
    { name: 'Bookings', href: '/bookings', icon: CalendarIcon },
    { name: 'POS', href: '/pos', icon: ShoppingCartIcon },
    { name: 'Attendance', href: '/attendance', icon: ClockIcon },
    { name: 'More', href: null, icon: MenuIcon, action: () => setSidebarOpen(true) },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isCurrentPage = (href) => {
    return location.pathname === href;
  };

  const NavLink = ({ item, onClick }) => {
    const Icon = item.icon;
    return (
      <Link
        to={item.href}
        onClick={onClick}
        className={`${isCurrentPage(item.href)
            ? 'bg-blue-100 text-blue-900'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          } group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors duration-150`}
        aria-current={isCurrentPage(item.href) ? 'page' : undefined}
      >
        <Icon className="mr-3 h-5 w-5 flex-shrink-0" aria-hidden="true" />
        {item.name}
      </Link>
    );
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gray-100">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Mobile navigation menu">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />

          {/* Sidebar panel */}
          <div className="fixed inset-y-0 left-0 flex flex-col w-72 max-w-[80vw] bg-white shadow-xl transform transition-transform duration-300 ease-in-out">
            {/* Sidebar header */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 flex-shrink-0">
              <h1 className="text-lg font-bold text-gray-900">Vonne X2X</h1>
              <button
                type="button"
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close sidebar"
              >
                <XIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Navigation links */}
            <div className="flex-1 overflow-y-auto py-4 px-3">
              <nav className="space-y-1" role="navigation" aria-label="Main navigation">
                {navigation.map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
              </nav>
            </div>

            {/* User info + logout */}
            <div className="flex-shrink-0 border-t border-gray-200 p-4" role="region" aria-label="User account">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-blue-100 rounded-full p-2">
                  <UserIcon className="h-5 w-5 text-blue-600" aria-hidden="true" />
                </div>
                <div className="ml-3 flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-2 p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Logout"
                  aria-label="Logout"
                >
                  <LogoutIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col h-0 flex-1 bg-white border-r border-gray-200" role="complementary" aria-label="Main navigation sidebar">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-4">
                <h1 className="text-xl font-bold text-gray-900">Vonne X2X</h1>
              </div>
              <nav className="mt-5 flex-1 px-3 space-y-1" role="navigation" aria-label="Main navigation">
                {navigation.map((item) => (
                  <NavLink key={item.name} item={item} />
                ))}
              </nav>
            </div>
            <div className="flex-shrink-0 flex border-t border-gray-200 p-4" role="region" aria-label="User account information">
              <div className="flex items-center w-full">
                <div className="flex-shrink-0 bg-blue-100 rounded-full p-2">
                  <UserIcon className="h-5 w-5 text-blue-600" aria-hidden="true" />
                </div>
                <div className="ml-3 flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-2 p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Logout"
                  aria-label="Logout"
                >
                  <LogoutIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col w-0 flex-1 overflow-hidden">
        {/* Top bar */}
        <header className="relative z-10 flex-shrink-0 flex h-14 sm:h-16 bg-white shadow" role="banner">
          <button
            type="button"
            className="px-3 sm:px-4 border-r border-gray-200 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 md:hidden transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <MenuIcon className="h-6 w-6" aria-hidden="true" />
          </button>
          <div className="flex-1 px-3 sm:px-4 flex justify-between items-center">
            <div className="flex items-center">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate" id="page-title">
                {navigation.find(item => isCurrentPage(item.href))?.name || 'Dashboard'}
              </h2>
            </div>
            <div className="flex items-center gap-2 sm:gap-4" role="region" aria-label="User actions">
              <span className="text-xs sm:text-sm text-gray-700 hidden sm:inline truncate max-w-[200px]" aria-label={`Welcome message for ${user?.name}`}>
                Welcome, {user?.name}
              </span>
              <button
                onClick={handleLogout}
                className="p-1.5 sm:p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 md:hidden transition-colors"
                aria-label="Logout"
              >
                <LogoutIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>

        {/* Page content - add bottom padding on mobile for bottom nav */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none" role="main" aria-labelledby="page-title">
          <div className="py-4 sm:py-6 pb-20 md:pb-6">
            <div className="mx-auto px-2 sm:px-4 md:px-6">
              <Outlet />
            </div>
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-lg md:hidden" role="navigation" aria-label="Quick navigation">
          <div className="flex items-center justify-around h-14">
            {bottomNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.href && isCurrentPage(item.href);

              if (item.action) {
                return (
                  <button
                    key={item.name}
                    onClick={item.action}
                    className="flex flex-col items-center justify-center flex-1 h-full py-1 text-gray-500 hover:text-blue-600 transition-colors"
                    aria-label={item.name}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    <span className="text-[10px] mt-0.5 font-medium">{item.name}</span>
                  </button>
                );
              }

              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${isActive
                      ? 'text-blue-600'
                      : 'text-gray-500 hover:text-blue-600'
                    }`}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={item.name}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'text-blue-600' : ''}`} aria-hidden="true" />
                  <span className={`text-[10px] mt-0.5 font-medium ${isActive ? 'text-blue-600' : ''}`}>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default Layout;