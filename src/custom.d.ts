// Tell TypeScript that importing a .md file returns its content as a string
declare module '*.md' {
  const content: string;
  export default content;
}
