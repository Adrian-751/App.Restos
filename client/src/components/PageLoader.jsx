const PageLoader = ({ text = 'Cargando...' }) => {
    return (
        <div className="card text-center py-10">
            <p className="text-slate-400">{text}</p>
        </div>
    )
}

export default PageLoader

