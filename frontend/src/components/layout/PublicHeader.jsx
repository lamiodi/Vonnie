import React, { useState } from 'react'
import { Link } from 'react-router-dom'

const PublicHeader = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  return (
    <header className="bg-white shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2" onClick={closeMobileMenu}>
            <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-secondary-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Vonne X2x</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link 
              to="/book" 
              className="text-gray-700 hover:text-primary-600 font-medium transition-colors"
            >
              Book Service
            </Link>
            <a 
              href="#services" 
              className="text-gray-700 hover:text-primary-600 font-medium transition-colors"
            >
              Services
            </a>
            <a 
              href="#about" 
              className="text-gray-700 hover:text-primary-600 font-medium transition-colors"
            >
              About
            </a>
            <a 
              href="#contact" 
              className="text-gray-700 hover:text-primary-600 font-medium transition-colors"
            >
              Contact
            </a>
            <Link 
              to="/register" 
              className="text-gray-700 hover:text-primary-600 font-medium transition-colors"
            >
              Staff Register
            </Link>
            <Link 
              to="/login" 
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              Staff Login
            </Link>
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={toggleMobileMenu}
            className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-primary-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
            aria-expanded="false"
          >
            <span className="sr-only">Open main menu</span>
            {/* Hamburger icon */}
            <svg
              className={`${isMobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
            {/* Close icon */}
            <svg
              className={`${isMobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Mobile Navigation Menu */}
        <div className={`md:hidden ${isMobileMenuOpen ? 'block' : 'hidden'}`}>
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t border-gray-200">
            <Link
              to="/book"
              className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 rounded-md transition-colors"
              onClick={closeMobileMenu}
            >
              Book Service
            </Link>
            <a
              href="#services"
              className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 rounded-md transition-colors"
              onClick={closeMobileMenu}
            >
              Services
            </a>
            <a
              href="#about"
              className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 rounded-md transition-colors"
              onClick={closeMobileMenu}
            >
              About
            </a>
            <a
              href="#contact"
              className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 rounded-md transition-colors"
              onClick={closeMobileMenu}
            >
              Contact
            </a>
            <Link
              to="/register"
              className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-primary-600 hover:bg-gray-50 rounded-md transition-colors"
              onClick={closeMobileMenu}
            >
              Staff Register
            </Link>
            <Link
              to="/login"
              className="block px-3 py-2 text-base font-medium bg-primary-600 text-white hover:bg-primary-700 rounded-md transition-colors"
              onClick={closeMobileMenu}
            >
              Staff Login
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}

export default PublicHeader