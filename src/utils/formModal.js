/**
 * How wide a document form opens.
 *
 * Shared by the bill and the job card. The two are opened for the same work
 * minutes apart and carry the same line table, so a different size reads as
 * a different kind of screen — and the card spent a while at 460 against the
 * bill's 1300 for exactly that reason.
 *
 * Effectively the whole screen: the line table carries eleven columns, and a
 * 1300 cap left it scrolling sideways on the 1366-wide laptops most of the
 * shop works on. The modal is `width: 100%` under this cap, so on a narrower
 * screen it simply fills it.
 */
export const FORM_MODAL_WIDTH = 1800;
