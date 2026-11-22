const COLORS = ['#8c2235', '#0f766e', '#5b3a9b', '#1e4f91']

// Round badge with a member's initials. "light" is for the top bar.
export default function Avatar({ member, light = false }) {
  if (!member) {
    return (
      <span className="avatar avatar--empty" title="Unassigned">
        ?
      </span>
    )
  }
  const initials = member.name.slice(0, 2).toUpperCase()
  const style = light ? undefined : { background: COLORS[(member.id - 1) % COLORS.length] }
  return (
    <span className={`avatar${light ? ' avatar--light' : ''}`} style={style} title={member.name}>
      {member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : initials}
    </span>
  )
}
