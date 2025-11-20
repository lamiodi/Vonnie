import React, { useState } from 'react';
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
  UserIcon
} from '@heroicons/react/outline';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
    { name: 'Bookings', href: '/bookings', icon: CalendarIcon },
    { name: 'POS', href: '/pos', icon: ShoppingCartIcon },
    { name: 'Inventory', href: '/inventory', icon: CubeIcon },
    { name: 'Workers', href: '/workers', icon: UserGroupIcon },
    { name: 'Attendance', href: '/attendance', icon: ClockIcon },
    { name: 'Coupons', href: '/coupons', icon: TicketIcon },
    { name: 'Reports', href: '/reports', icon: DocumentReportIcon },
    { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
    { name: 'Transactions', href: '/transactions', icon: DocumentReportIcon },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isCurrentPage = (href) => {
    return location.pathname === href;
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gray-100">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 flex z-40 md:hidden ${sidebarOpen ? '' : 'hidden'}`} role="dialog" aria-modal="true" aria-label="Mobile navigation menu">
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
        <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              <XIcon className="h-6 w-6 text-white" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
            <div className="flex-shrink-0 flex items-center px-4">
              <h1 className="text-xl font-bold text-gray-900">Vonne X2X</h1>
            </div>
            <nav className="mt-5 px-2 space-y-1" role="navigation" aria-label="Main navigation">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`${
                      isCurrentPage(item.href)
                        ? 'bg-blue-100 text-blue-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
                    aria-current={isCurrentPage(item.href) ? 'page' : undefined}
                  >
                    <Icon className="mr-3 h-5 w-5" aria-hidden="true" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex-shrink-0 flex border-t border-gray-200 p-4" role="region" aria-label="User account information">
            <div className="flex items-center w-full">
              <div className="flex-shrink-0">
                <UserIcon className="h-8 w-8 text-gray-400" aria-hidden="true" />
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-700">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="ml-2 p-1 text-gray-400 hover:text-gray-600"
                title="Logout"
                aria-label="Logout"
              >
                <LogoutIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <div className="flex flex-col w-64">
          <div className="flex flex-col h-0 flex-1 bg-white border-r border-gray-200" role="complementary" aria-label="Main navigation sidebar">
            <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <div className="flex items-center flex-shrink-0 px-4">
                <h1 className="text-xl font-bold text-gray-900">Vonne X2X</h1>
              </div>
              <nav className="mt-5 flex-1 px-2 space-y-1" role="navigation" aria-label="Main navigation">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`${
                        isCurrentPage(item.href)
                          ? 'bg-blue-100 text-blue-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
                      aria-current={isCurrentPage(item.href) ? 'page' : undefined}
                    >
                      <Icon className="mr-3 h-5 w-5" aria-hidden="true" />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex-shrink-0 flex border-t border-gray-200 p-4" role="region" aria-label="User account information">
              <div className="flex items-center w-full">
                <div className="flex-shrink-0">
                  <UserIcon className="h-8 w-8 text-gray-400" aria-hidden="true" />
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-700">{user?.name}</p>
                  <p className="text-xs text-gray-500">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="ml-2 p-1 text-gray-400 hover:text-gray-600"
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
        <header className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow" role="banner">
          <button
            type="button"
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <MenuIcon className="h-6 w-6" aria-hidden="true" />
          </button>
          <div className="flex-1 px-4 flex justify-between">
            <div className="flex-1 flex">
              <div className="w-full flex md:ml-0">
                <div className="relative w-full text-gray-400 focus-within:text-gray-600">
                  <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                    <h2 className="text-lg font-semibold text-gray-900 ml-2" id="page-title">
                      {navigation.find(item => isCurrentPage(item.href))?.name || 'Dashboard'}
                    </h2>
                  </div>
                </div>
              </div>
            </div>
            <div className="ml-4 flex items-center md:ml-6" role="region" aria-label="User actions">
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-700" aria-label={`Welcome message for ${user?.name}`}>Welcome, {user?.name}</span>
                <button
                  onClick={handleLogout}
                  className="bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 md:hidden"
                  aria-label="Logout"
                >
                  <LogoutIcon className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none" role="main" aria-labelledby="page-title">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;