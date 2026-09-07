/// <reference types="nativewind/types" />

// Metro turns the Tailwind entry into a module; TypeScript needs telling that a
// side-effect import of it is legitimate.
declare module '*.css';
