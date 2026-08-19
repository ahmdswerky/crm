# Product

## Register

product

## Platform

web

## Users

The primary audience is mixed internal CRM staff: property-sales agents working leads and deals throughout the day, managers monitoring the shared pipeline, and administrators managing staff access. Users are task-focused and often move repeatedly between people, properties, and transactions. Navigation and actions must follow the permissions returned for the authenticated user rather than assuming every staff member is an administrator.

## Product Purpose

The dashboard gives CRM staff one dependable operational surface for leads, deals, property listings, accounts, contacts, and users. Phase one succeeds when a permitted staff member can authenticate, locate a record, inspect its context, create or update it through the documented API, understand errors, and complete routine work without guessing what the system is doing.

Payments are a later product area. Phase one establishes a clean feature boundary for payments without presenting unfinished payment behavior to users.

## Positioning

A contract-grounded real-estate CRM that keeps related people, properties, and sales work legible in one calm, permission-aware workspace.

## Brand Personality

Composed, tactile, and exact. The product should feel like a well-kept operational ledger translated into modern software: quiet enough for long work sessions, dense enough for experienced staff, and precise enough to trust.

## Anti-references

- Generic SaaS dashboard card walls with oversized metrics and decorative charts.
- Vibrant purple or blue gradients, neon accents, and glassmorphism.
- Cream, beige, parchment, or faux-vintage warmth used as the main surface.
- Literal notebook skeuomorphism such as spiral bindings, torn paper, sticky notes, leather, or handwriting.
- Over-rounded controls, nested cards, heavy shadows, and decorative motion.
- Fake analytics, invented global search, undocumented filters, and placeholder payment functionality.
- Unfamiliar custom controls that replace standard table, form, dialog, navigation, or disclosure behavior.

## Design Principles

1. **The contract is visible.** The interface exposes only behavior supported by the OpenAPI documents and explains unavailable or failed actions clearly.
2. **Structure before decoration.** Hierarchy comes from typography, alignment, whitespace, and rules; color and elevation remain scarce.
3. **Dense, never cramped.** Experienced users can scan many records without sacrificing readable labels, touch targets, focus states, or responsive behavior.
4. **Context stays nearby.** Desktop entity pages keep the selected record in a stable inspector; smaller screens preserve the same context through route-addressable full-page details.
5. **Permissions shape the product.** Hidden or disabled actions always follow documented permissions, and route guards provide a clear forbidden state.

## Accessibility & Inclusion

Target WCAG 2.2 AA. All workflows must support keyboard navigation, visible focus, semantic forms and tables, accessible validation, reduced motion, sufficient contrast, and screen-reader announcements for asynchronous results. English LTR is the initial locale, but components and layouts must use logical properties and RTL-compatible shadcn generation so Arabic can be added without rebuilding the interface.

