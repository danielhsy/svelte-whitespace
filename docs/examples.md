# Examples

These are tests generated from `test/conformance/examples.ts` by `npm run docs`. Each is rendered with Svelte under each preset and formatted with the Prettier plugin at several widths.

* ```svelte
  <p>
  	<span>a</span>
  	<span>b</span>
  </p>
  ```

  | Preset | Renders |
  | --- | --- |
  | `display` | `<p><span>a</span> <span>b</span></p>` |
  | `jsx` | `<p><span>a</span><span>b</span></p>` |

* ```svelte
  <p>
  	Hello
  	<em>world</em>
  	again
  </p>
  ```

  | Preset | Renders |
  | --- | --- |
  | `display` | `<p>Hello <em>world</em> again</p>` |
  | `jsx` | `<p>Hello<em>world</em>again</p>` |

* ```svelte
  <p>Hello <em>world</em> again</p>
  ```

  | Preset | Renders |
  | --- | --- |
  | `display` | `<p>Hello <em>world</em> again</p>` |
  | `jsx` | `<p>Hello <em>world</em> again</p>` |

* ```svelte
  <p>one
  	two  three</p>
  ```

  | Preset | Renders |
  | --- | --- |
  | `display` | `<p>one two three</p>` |
  | `jsx` | `<p>one two three</p>` |

* ```svelte
  <a>x</a> <b>y</b>
  ```

  | Preset | Renders |
  | --- | --- |
  | `display` | `<a>x</a> <b>y</b>` |
  | `jsx` | `<a>x</a> <b>y</b>` |

* ```svelte
  <svelte:head>
  	<meta name="a" />
  	<meta name="b" />
  </svelte:head>
  ```

  | Preset | Renders |
  | --- | --- |
  | `display` | `<meta name="a"/><meta name="b"/>` |
  | `jsx` | `<meta name="a"/><meta name="b"/>` |

* ```svelte
  <p>a{' '}
  	<b>b</b></p>
  ```

  | Preset | Renders |
  | --- | --- |
  | `display` | `<p>a  <b>b</b></p>` |
  | `jsx` | `<p>a <b>b</b></p>` |

* ```svelte
  <p><b>a</b>&#32;<b>b</b></p>
  ```

  | Preset | Renders |
  | --- | --- |
  | `display` | `<p><b>a</b> <b>b</b></p>` |
  | `jsx` | `<p><b>a</b> <b>b</b></p>` |

* ```svelte
  <pre>
  	x
  </pre>
  ```

  | Preset | Renders |
  | --- | --- |
  | `display` | [_Unchanged_] |
  | `jsx` | [_Unchanged_] |

* ```svelte
  <p>
  	Hello
  	{name}
  </p>
  ```

  | Preset | Renders |
  | --- | --- |
  | `display` | `<p>Hello N</p>` |
  | `jsx` | `<p>HelloN</p>` |

* ```svelte
  <p>
  	A
  	{#if ok}
  		<b>B</b>
  	{/if}
  	C
  </p>
  ```

  | Preset | Renders |
  | --- | --- |
  | `display` | `<p>A <b>B</b> C</p>` |
  | `jsx` | `<p>A<b>B</b>C</p>` |

* ```svelte
  <p><b> a </b>b</p>
  ```

  | Preset | Renders |
  | --- | --- |
  | `display` | `<p><b>a</b>b</p>` |
  | `jsx` | `<p><b> a </b>b</p>` |

* ```svelte
  <div>a</div> <div>b</div>
  ```

  | Preset | Renders |
  | --- | --- |
  | `display` | `<div>a</div><div>b</div>` |
  | `jsx` | `<div>a</div> <div>b</div>` |

* ```svelte
  <p>
  	Posted by {author}
  	{#if date}
  		on <time>{date}</time>
  	{/if}
  </p>
  ```

  | Preset | Renders |
  | --- | --- |
  | `display` | `<p>Posted by A on <time>D</time></p>` |
  | `jsx` | `<p>Posted by Aon <time>D</time></p>` |

* ```svelte
  <p>
  	<Icon />
  	Save
  </p>
  ```

  | Preset | Renders |
  | --- | --- |
  | `display` | `<p><i></i> Save</p>` |
  | `jsx` | `<p><i></i>Save</p>` |

* ```svelte
  <!-- svelte-whitespace: svelte -->
  <p>
  	<b>a</b>
  	<b>b</b>
  </p>
  ```

  | Preset | Renders |
  | --- | --- |
  | `display` | `<p><b>a</b> <b>b</b></p>` |
  | `jsx` | `<p><b>a</b> <b>b</b></p>` |
