interface PostPreviewProps {
  content: string
  postType?: string
}

export default function PostPreview({ content, postType }: PostPreviewProps) {
  const charCount = content.length
  const isOver = charCount > 140

  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-700">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-gray-400 text-sm">プレビュー</span>
        {postType && (
          <span className="text-xs text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">
            {postType}
          </span>
        )}
      </div>
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-lg flex-shrink-0">
          🍊
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-white">らくーん</span>
            <span className="text-xs text-gray-400">@raccoon_diet</span>
          </div>
          <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
            {content || <span className="text-gray-500">投稿内容がここに表示されます...</span>}
          </p>
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-800">
            <div className="flex items-center gap-4 text-gray-500 text-xs">
              <span>💬 0</span>
              <span>🔁 0</span>
              <span>❤️ 0</span>
              <span>🔖 0</span>
            </div>
            <span className={`text-xs font-mono ${isOver ? 'text-red-400' : charCount > 120 ? 'text-yellow-400' : 'text-gray-400'}`}>
              {charCount}/140
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
