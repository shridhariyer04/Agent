import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'

function App() {
 
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [brand, setBrand] = useState(null)
  const [data, setData] = useState([])
  const [error, setError] = useState(null)


  const handleGenerate = async () =>{

    if(!url) return;
    setLoading(true)
    setError(true)
    setData([])
    setBrand(null);


    try {
      const res = await fetch("http://localhost:3000/api/agent/run",{
        method:"POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const result = await res.json();
  if (!result.success) throw new Error("Agent returned success: false");

   setBrand(result.brand);       // { name, url }
      setData(result.content);      // ← FIX: was setData(result)
      
    } catch (error) {
       setError(err.message);
    }
        setLoading(false);
  }


const copyPost = (post)=>{
  const text = [post.hook, post.body, post.cta, post.hashtags.join(" ")].join("\n\n");
  navigatior.clipboard.writeText(text);
}
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-6">
          Website → Social Content Generator
        </h1>

        {/* Input */}
        <div className="flex gap-3 mb-6">
          <input
            type="text"
            placeholder="Enter website URL..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
          />
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="bg-black text-white px-5 py-2 rounded-lg hover:opacity-80 disabled:opacity-40"
          >
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-500 text-sm mb-4">Error: {error}</p>
        )}

        {/* Brand bar */}
        {brand && (
          <div className="bg-white border rounded-lg px-4 py-2 mb-6 text-sm text-gray-500">
            <span className="font-medium text-black">{brand.name}</span>
            &nbsp;·&nbsp;{brand.url}
          </div>
        )}

        {/* Results — map over result.content, not result */}
        <div className="space-y-8">
          {data.map((platformBlock, i) => (
            <div key={i}>
              <h2 className="text-xl font-semibold mb-3 capitalize">
                {platformBlock.platform}
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {platformBlock.posts.map((post, j) => (
                  <div
                    key={j}
                    className="bg-white p-4 rounded-xl shadow-sm border hover:shadow-md transition"
                  >
                    <h3 className="font-semibold text-lg mb-2">{post.hook}</h3>
                    <p className="text-gray-700 text-sm whitespace-pre-line">
                      {post.body}
                    </p>
                    <p className="mt-3 font-medium text-black">{post.cta}</p>
                    <p className="mt-2 text-blue-500 text-sm">
                      {post.hashtags.join(" ")}
                    </p>
                    <div className="flex justify-between items-center mt-3">
                      <p className="text-xs text-gray-400">
                        {post.characterCount} chars
                      </p>
                      <button
                        onClick={() => copyPost(post)}
                        className="text-xs border px-2 py-1 rounded hover:bg-gray-50"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );


}

export default App
