Updating a style property during rerender (borderLeft) when a conflicting property is set (border) can lead to styling bugs. To avoid this, don't mix shorthand and non-shorthand properties for the same value; instead, replace the shorthand with separate values.

src/app/user/(main)/loja/page.tsx (376:17) @ <unknown>


  374 |               const active = cat === key;
  375 |               return (
> 376 |                 <button
      |                 ^
  377 |                   key={key}
  378 |                   type="button"
  379 |                   onClick={() => handleCatChange(key)}